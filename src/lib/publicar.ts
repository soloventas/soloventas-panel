// Publica en Instagram y Facebook usando la página conectada.
//
// Instagram trabaja en dos pasos: primero se crea un "contenedor" con la foto
// o el video (Meta lo descarga y procesa), y cuando está listo se publica.
// Por eso una publicación de Instagram puede quedar unos segundos o minutos
// en PROCESANDO; el panel consulta el estado hasta que termina.

import { prisma } from "@/lib/prisma";
import { graphGet, graphPost, obtenerIntegracion, ErrorMeta } from "@/lib/meta";

export type FormatoPub = "FOTO" | "CARRUSEL" | "VIDEO";
export type RedPub = "INSTAGRAM" | "FACEBOOK";

export const MAX_CARRUSEL = 10;
export const MAX_TEXTO_INSTAGRAM = 2200;

function mensajeError(e: unknown) {
  if (e instanceof ErrorMeta) return e.message;
  if (e instanceof Error) return e.message;
  return "Error desconocido al publicar.";
}

// ---------------------------------------------------------------- Instagram

async function crearContenedorInstagram(
  igId: string,
  token: string,
  formato: FormatoPub,
  urls: string[],
  texto: string
): Promise<string> {
  if (formato === "FOTO") {
    const r = await graphPost(`${igId}/media`, {
      image_url: urls[0],
      caption: texto,
      access_token: token,
    });
    return r.id;
  }

  if (formato === "VIDEO") {
    const r = await graphPost(`${igId}/media`, {
      media_type: "REELS",
      video_url: urls[0],
      caption: texto,
      share_to_feed: true,
      access_token: token,
    });
    return r.id;
  }

  // Carrusel: un contenedor por foto y después el contenedor "padre".
  const hijos: string[] = [];
  for (const url of urls.slice(0, MAX_CARRUSEL)) {
    const r = await graphPost(`${igId}/media`, {
      image_url: url,
      is_carousel_item: true,
      access_token: token,
    });
    hijos.push(r.id);
  }
  const r = await graphPost(`${igId}/media`, {
    media_type: "CAROUSEL",
    children: hijos.join(","),
    caption: texto,
    access_token: token,
  });
  return r.id;
}

// Revisa si el contenedor de Instagram ya está listo y, si lo está, publica.
export async function avanzarInstagram(publicacionId: string) {
  const pub = await prisma.publicacion.findUnique({ where: { id: publicacionId } });
  if (!pub || pub.red !== "INSTAGRAM" || pub.estado !== "PROCESANDO" || !pub.contenedor) {
    return pub;
  }

  const ig = await obtenerIntegracion("instagram");
  if (!ig?.externalId) {
    return prisma.publicacion.update({
      where: { id: pub.id },
      data: { estado: "ERROR", error: "Instagram no está conectado." },
    });
  }

  try {
    const estado = await graphGet(pub.contenedor, {
      fields: "status_code,status",
      access_token: ig.accessToken,
    });

    if (estado.status_code === "IN_PROGRESS") return pub;

    if (estado.status_code === "ERROR" || estado.status_code === "EXPIRED") {
      return prisma.publicacion.update({
        where: { id: pub.id },
        data: {
          estado: "ERROR",
          error:
            estado.status ||
            "Instagram no pudo procesar el archivo. Revisá formato, proporción y duración.",
        },
      });
    }

    // FINISHED (o PUBLISHED si ya se había publicado)
    const publicado = await graphPost(`${ig.externalId}/media_publish`, {
      creation_id: pub.contenedor,
      access_token: ig.accessToken,
    });

    let permalink: string | null = null;
    try {
      const info = await graphGet(publicado.id, {
        fields: "permalink",
        access_token: ig.accessToken,
      });
      permalink = info.permalink ?? null;
    } catch {
      // El enlace es un extra; si falla, la publicación igual quedó hecha.
    }

    return prisma.publicacion.update({
      where: { id: pub.id },
      data: {
        estado: "PUBLICADA",
        externalId: publicado.id,
        permalink,
        publicadaAt: new Date(),
      },
    });
  } catch (e) {
    return prisma.publicacion.update({
      where: { id: pub.id },
      data: { estado: "ERROR", error: mensajeError(e) },
    });
  }
}

// ----------------------------------------------------------------- Facebook

async function publicarFacebook(
  pageId: string,
  token: string,
  formato: FormatoPub,
  urls: string[],
  texto: string
) {
  if (formato === "VIDEO") {
    const r = await graphPost(`${pageId}/videos`, {
      file_url: urls[0],
      description: texto,
      access_token: token,
    });
    return { id: r.id as string, permalink: `https://www.facebook.com/${r.id}` };
  }

  if (formato === "FOTO") {
    const r = await graphPost(`${pageId}/photos`, {
      url: urls[0],
      caption: texto,
      access_token: token,
    });
    const postId = (r.post_id || r.id) as string;
    return { id: postId, permalink: `https://www.facebook.com/${postId}` };
  }

  // Varias fotos: se suben sin publicar y después se arma un solo posteo.
  const fotos: string[] = [];
  for (const url of urls) {
    const r = await graphPost(`${pageId}/photos`, {
      url,
      published: false,
      access_token: token,
    });
    fotos.push(r.id);
  }
  const r = await graphPost(`${pageId}/feed`, {
    message: texto,
    attached_media: JSON.stringify(fotos.map((id) => ({ media_fbid: id }))),
    access_token: token,
  });
  return { id: r.id as string, permalink: `https://www.facebook.com/${r.id}` };
}

// ------------------------------------------------------------------ General

export async function crearPublicacion(opciones: {
  productoId: string;
  red: RedPub;
  formato: FormatoPub;
  urls: string[];
  texto: string;
}) {
  const { productoId, red, formato, urls, texto } = opciones;

  const pub = await prisma.publicacion.create({
    data: { productoId, red, formato, texto, mediaUrls: urls, estado: "PROCESANDO" },
  });

  try {
    if (red === "INSTAGRAM") {
      const ig = await obtenerIntegracion("instagram");
      if (!ig?.externalId) throw new Error("Instagram no está conectado.");
      const contenedor = await crearContenedorInstagram(
        ig.externalId,
        ig.accessToken,
        formato,
        urls,
        texto
      );
      await prisma.publicacion.update({ where: { id: pub.id }, data: { contenedor } });
      // Las fotos suelen estar listas enseguida: intentamos publicar ya.
      return avanzarInstagram(pub.id);
    }

    const fb = await obtenerIntegracion("facebook");
    if (!fb?.externalId) throw new Error("Facebook no está conectado.");
    const r = await publicarFacebook(fb.externalId, fb.accessToken, formato, urls, texto);
    return prisma.publicacion.update({
      where: { id: pub.id },
      data: {
        estado: "PUBLICADA",
        externalId: r.id,
        permalink: r.permalink,
        publicadaAt: new Date(),
      },
    });
  } catch (e) {
    return prisma.publicacion.update({
      where: { id: pub.id },
      data: { estado: "ERROR", error: mensajeError(e) },
    });
  }
}
