// Publica videos en TikTok con la Content Posting API.
//
// TikTok también trabaja en dos pasos: el panel le avisa que va a mandar un
// video (init), sube el archivo y después TikTok lo procesa. Mientras tanto la
// publicación queda en PROCESANDO y el panel consulta el estado.
//
// Hay dos modos:
//   - "DIRECTO": se publica en el perfil (permiso video.publish).
//   - "BORRADOR": llega a la bandeja de TikTok del usuario para que lo termine
//     de editar y publicar desde la app (permiso video.upload).

import { prisma } from "@/lib/prisma";

const API = "https://open.tiktokapis.com/v2";

export type PrivacidadTikTok =
  | "PUBLIC_TO_EVERYONE"
  | "MUTUAL_FOLLOW_FRIENDS"
  | "FOLLOWER_OF_CREATOR"
  | "SELF_ONLY";

export type OpcionesTikTok = {
  modo: "DIRECTO" | "BORRADOR";
  privacidad?: PrivacidadTikTok;
  permitirComentarios?: boolean;
  permitirDuo?: boolean;
  permitirStitch?: boolean;
  contenidoComercial?: boolean;
  marcaPropia?: boolean;
  contenidoPatrocinado?: boolean;
};

export const MAX_TITULO_TIKTOK = 2200;

// TikTok pide subir en partes de 5 a 64 MB; hasta 64 MB va en una sola.
const UNA_PARTE = 64 * 1024 * 1024;
const TAMANO_PARTE = 10 * 1024 * 1024;

export class ErrorTikTok extends Error {}

async function tiktokPost(ruta: string, token: string, body: unknown) {
  const res = await fetch(`${API}${ruta}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data?.error?.code && data.error.code !== "ok")) {
    throw new ErrorTikTok(data?.error?.message || data?.error?.code || "TikTok rechazó el pedido.");
  }
  return data.data;
}

// Devuelve un token válido, renovándolo si venció (dura 24 horas).
export async function tokenTikTok() {
  const integ = await prisma.integracionRed.findUnique({ where: { clave: "tiktok" } });
  if (!integ) throw new ErrorTikTok("TikTok no está conectado.");

  const vigente = integ.expiraEn && integ.expiraEn.getTime() > Date.now() + 5 * 60 * 1000;
  if (vigente) return integ.accessToken;

  const extra = (integ.extra || {}) as { refreshToken?: string | null };
  if (!extra.refreshToken) {
    throw new ErrorTikTok("La conexión con TikTok venció. Volvé a conectarla en Redes sociales.");
  }

  const res = await fetch(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY || "",
      client_secret: process.env.TIKTOK_CLIENT_SECRET || "",
      grant_type: "refresh_token",
      refresh_token: extra.refreshToken,
    }),
    cache: "no-store",
  });
  const token = await res.json().catch(() => ({}));
  if (!res.ok || !token.access_token) {
    throw new ErrorTikTok("La conexión con TikTok venció. Volvé a conectarla en Redes sociales.");
  }

  await prisma.integracionRed.update({
    where: { clave: "tiktok" },
    data: {
      accessToken: token.access_token,
      expiraEn: new Date(Date.now() + Number(token.expires_in || 86400) * 1000),
      extra: {
        ...(integ.extra as object),
        refreshToken: token.refresh_token ?? extra.refreshToken,
        refreshExpiraEn: token.refresh_expires_in
          ? new Date(Date.now() + Number(token.refresh_expires_in) * 1000).toISOString()
          : null,
      },
    },
  });
  return token.access_token as string;
}

// Datos de la cuenta que TikTok exige mostrar antes de publicar.
export async function infoCreador() {
  const token = await tokenTikTok();
  const d = await tiktokPost("/post/publish/creator_info/query/", token, {});
  return {
    nombre: d.creator_nickname as string,
    usuario: d.creator_username as string,
    avatar: d.creator_avatar_url as string,
    privacidades: (d.privacy_level_options || []) as PrivacidadTikTok[],
    comentariosDesactivados: Boolean(d.comment_disabled),
    duoDesactivado: Boolean(d.duet_disabled),
    stitchDesactivado: Boolean(d.stitch_disabled),
    duracionMaxima: Number(d.max_video_post_duration_sec || 0),
  };
}

// Descarga el video del panel y lo sube a TikTok. Devuelve el publish_id.
export async function iniciarVideoTikTok(url: string, titulo: string, op: OpcionesTikTok) {
  const token = await tokenTikTok();

  const archivo = await fetch(url, { cache: "no-store" });
  if (!archivo.ok) throw new ErrorTikTok("No se pudo leer el video para subirlo a TikTok.");
  const video = new Uint8Array(await archivo.arrayBuffer());
  const tamano = video.byteLength;

  const partes = tamano <= UNA_PARTE ? 1 : Math.floor(tamano / TAMANO_PARTE);
  const tamanoParte = partes === 1 ? tamano : TAMANO_PARTE;
  const sourceInfo = {
    source: "FILE_UPLOAD",
    video_size: tamano,
    chunk_size: tamanoParte,
    total_chunk_count: partes,
  };

  let init;
  if (op.modo === "BORRADOR") {
    init = await tiktokPost("/post/publish/inbox/video/init/", token, { source_info: sourceInfo });
  } else {
    if (!op.privacidad) throw new ErrorTikTok("Elegí quién puede ver el video en TikTok.");
    init = await tiktokPost("/post/publish/video/init/", token, {
      post_info: {
        title: titulo.slice(0, MAX_TITULO_TIKTOK),
        privacy_level: op.privacidad,
        disable_comment: !op.permitirComentarios,
        disable_duet: !op.permitirDuo,
        disable_stitch: !op.permitirStitch,
        brand_organic_toggle: Boolean(op.contenidoComercial && op.marcaPropia),
        brand_content_toggle: Boolean(op.contenidoComercial && op.contenidoPatrocinado),
      },
      source_info: sourceInfo,
    });
  }

  // La última parte se lleva lo que sobra.
  for (let i = 0; i < partes; i++) {
    const desde = i * tamanoParte;
    const hasta = i === partes - 1 ? tamano : desde + tamanoParte;
    const res = await fetch(init.upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": archivo.headers.get("content-type") || "video/mp4",
        "Content-Length": String(hasta - desde),
        "Content-Range": `bytes ${desde}-${hasta - 1}/${tamano}`,
      },
      body: video.slice(desde, hasta),
    });
    if (!res.ok) throw new ErrorTikTok("TikTok no aceptó el archivo del video.");
  }

  return init.publish_id as string;
}

// Publica fotos (una o carrusel) en TikTok. TikTok las descarga de una URL
// que tiene que estar en el dominio verificado de la app, por eso se pasan las
// direcciones del panel (/api/media/publica), no las de Vercel Blob.
// Devuelve el publish_id.
export async function iniciarFotosTikTok(urls: string[], texto: string, op: OpcionesTikTok) {
  const token = await tokenTikTok();
  const source_info = {
    source: "PULL_FROM_URL",
    photo_images: urls.slice(0, 35),
    photo_cover_index: 0,
  };
  // El título de las fotos admite 90 caracteres: va la primera línea y el
  // texto completo como descripción.
  const titulo = (texto.split("\n").find((l) => l.trim()) || "").trim().slice(0, 90);
  const descripcion = texto.slice(0, 4000);

  if (op.modo === "BORRADOR") {
    const d = await tiktokPost("/post/publish/content/init/", token, {
      post_info: { title: titulo, description: descripcion },
      source_info,
      post_mode: "MEDIA_UPLOAD",
      media_type: "PHOTO",
    });
    return d.publish_id as string;
  }

  if (!op.privacidad) throw new ErrorTikTok("Elegí quién puede ver la publicación en TikTok.");
  const d = await tiktokPost("/post/publish/content/init/", token, {
    post_info: {
      title: titulo,
      description: descripcion,
      privacy_level: op.privacidad,
      disable_comment: !op.permitirComentarios,
      auto_add_music: true,
      brand_organic_toggle: Boolean(op.contenidoComercial && op.marcaPropia),
      brand_content_toggle: Boolean(op.contenidoComercial && op.contenidoPatrocinado),
    },
    source_info,
    post_mode: "DIRECT_POST",
    media_type: "PHOTO",
  });
  return d.publish_id as string;
}

// Consulta cómo va el video en TikTok.
export async function estadoTikTok(publishId: string) {
  const token = await tokenTikTok();
  const d = await tiktokPost("/post/publish/status/fetch/", token, { publish_id: publishId });
  return {
    estado: d.status as string,
    motivo: (d.fail_reason as string) || null,
    idPublicado: (d.publicaly_available_post_id?.[0] as string | undefined) ?? null,
  };
}
