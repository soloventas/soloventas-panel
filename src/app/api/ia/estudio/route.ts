import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { maximoPorTipo } from "@/lib/media";
import { enviarAFal, estadoFal, falConfigurado, resultadoFal } from "@/lib/fal";
import {
  MODELO_FOTO,
  MODELO_VIDEO,
  promptVideo,
  promptsPackFoto,
  type CalidadId,
  type EscenaId,
  type FormatoId,
  type PersonaId,
  type VideoTipoId,
} from "@/lib/estudio";

export const maxDuration = 60;

// Revisa los trabajos pendientes; los terminados se descargan, se guardan en
// Vercel Blob y quedan como foto/video IA pendiente de aprobación.
async function avanzarTrabajos(productoId: string) {
  const pendientes = await prisma.trabajoIA.findMany({
    where: { productoId, estado: "PENDIENTE" },
  });

  for (const t of pendientes) {
    try {
      const estado = await estadoFal(t.statusUrl);
      if (estado !== "COMPLETED") continue;

      const resultado = await resultadoFal(t.responseUrl);
      const url: string | undefined =
        t.tipo === "FOTO" ? resultado?.images?.[0]?.url : resultado?.video?.url;
      if (!url) throw new Error("La IA no devolvió ningún archivo.");

      const archivo = await fetch(url, { cache: "no-store" });
      if (!archivo.ok) throw new Error("No se pudo descargar el resultado de la IA.");
      const contentType =
        archivo.headers.get("content-type") || (t.tipo === "FOTO" ? "image/jpeg" : "video/mp4");
      const extension = t.tipo === "FOTO" ? "jpg" : "mp4";
      const datos = await archivo.arrayBuffer();

      const blob = await put(
        `productos/${productoId}/${t.tipo === "FOTO" ? "fotos" : "videos"}/ia-${t.id}.${extension}`,
        datos,
        { access: "public", addRandomSuffix: true, contentType }
      );

      const ultimo = await prisma.mediaProducto.findFirst({
        where: { productoId, tipo: t.tipo },
        orderBy: { orden: "desc" },
        select: { orden: true },
      });
      const media = await prisma.mediaProducto.create({
        data: {
          productoId,
          tipo: t.tipo,
          url: blob.url,
          pathname: blob.pathname,
          nombre: `IA ${t.tipo === "FOTO" ? "foto" : "video"}.${extension}`,
          tamano: datos.byteLength,
          orden: ultimo ? ultimo.orden + 1 : 0,
          origen: "IA",
          aprobado: false,
        },
      });

      await prisma.trabajoIA.update({
        where: { id: t.id },
        data: { estado: "LISTO", mediaId: media.id },
      });
    } catch (e) {
      await prisma.trabajoIA.update({
        where: { id: t.id },
        data: {
          estado: "ERROR",
          error: e instanceof Error ? e.message : "Falló la generación.",
        },
      });
    }
  }
}

// Lista los trabajos de IA de un producto (y avanza los pendientes).
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const productoId = req.nextUrl.searchParams.get("productoId");
  if (!productoId) return NextResponse.json({ error: "Falta el producto." }, { status: 400 });

  if (falConfigurado()) await avanzarTrabajos(productoId);

  const trabajos = await prisma.trabajoIA.findMany({
    where: { productoId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, tipo: true, estado: true, error: true, createdAt: true, mediaId: true },
  });
  return NextResponse.json(trabajos);
}

// Pide a la IA una foto o un video nuevo (modo automático).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  if (!falConfigurado()) {
    return NextResponse.json(
      { error: "El modo automático necesita la clave FAL_KEY en Vercel. Mientras tanto usá el modo gratis." },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    productoId?: string;
    tipo?: "FOTO" | "VIDEO";
    mediaIds?: string[];
    calidad?: CalidadId;
    escena?: EscenaId;
    escenaPersonalizada?: string;
    persona?: PersonaId;
    formato?: FormatoId;
    videoTipo?: VideoTipoId;
    duracion?: number;
    extra?: string;
  };

  const { productoId, tipo } = body;
  if (!productoId || (tipo !== "FOTO" && tipo !== "VIDEO")) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  const calidad: CalidadId = body.calidad === "premium" ? "premium" : "estandar";

  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { id: true, nombre: true },
  });
  if (!producto) return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });

  // Respetamos los límites contando también lo que la IA está generando.
  const [existentes, enCurso] = await Promise.all([
    prisma.mediaProducto.count({ where: { productoId, tipo } }),
    prisma.trabajoIA.count({ where: { productoId, tipo, estado: "PENDIENTE" } }),
  ]);
  // Las fotos salen de a 2 (producto real + con modelo).
  const nuevos = tipo === "FOTO" ? 2 : 1;
  if (existentes + enCurso + nuevos > maximoPorTipo(tipo)) {
    return NextResponse.json(
      {
        error:
          tipo === "FOTO"
            ? "No hay lugar para 2 fotos más (máximo 20). Borrá alguna para generar más."
            : "Ya llegaste al máximo de 5 videos. Borrá alguno para generar más.",
      },
      { status: 400 }
    );
  }

  // Fotos de base: solo fotos del producto, en el orden elegido.
  const ids = Array.isArray(body.mediaIds) ? body.mediaIds : [];
  const base = await prisma.mediaProducto.findMany({
    where: { productoId, id: { in: ids }, tipo: "FOTO" },
    select: { id: true, url: true },
  });
  const urls = ids
    .map((id) => base.find((b) => b.id === id)?.url)
    .filter((u): u is string => Boolean(u));
  if (urls.length === 0) {
    return NextResponse.json({ error: "Elegí al menos una foto de base." }, { status: 400 });
  }

  const escena = body.escena || "estudio";
  const persona = body.persona || "ninguna";

  const pedidos: { modelo: string; prompt: string; input: Record<string, unknown> }[] = [];

  if (tipo === "FOTO") {
    const pack = promptsPackFoto({
      producto: producto.nombre,
      escena,
      escenaPersonalizada: body.escenaPersonalizada,
      persona,
      formato: body.formato || "4:5",
      extra: body.extra,
    });
    for (const p of pack) {
      pedidos.push({
        modelo: MODELO_FOTO[calidad],
        prompt: p.prompt,
        input: {
          prompt: p.prompt,
          image_urls: urls.slice(0, 4),
          num_images: 1,
          aspect_ratio: body.formato || "4:5",
          output_format: "jpeg",
        },
      });
    }
  } else {
    const videoTipo = body.videoTipo || "giro";
    if (videoTipo === "colores" && urls.length < 2) {
      return NextResponse.json(
        { error: "Para el cambio de color elegí 2 fotos en distintos colores." },
        { status: 400 }
      );
    }
    const prompt = promptVideo({
      producto: producto.nombre,
      tipo: videoTipo,
      escena,
      escenaPersonalizada: body.escenaPersonalizada,
      persona,
      extra: body.extra,
    });
    const duracion = body.duracion === 10 ? 10 : 5;
    const input: Record<string, unknown> = {
      prompt,
      start_image_url: urls[0],
      duration: duracion,
      generate_audio: false,
      negative_prompt: "blur, distortion, deformed product, changed logo, extra text, watermark, low quality",
    };
    if (urls.length > 1) input.end_image_url = urls[urls.length - 1];
    pedidos.push({ modelo: MODELO_VIDEO[calidad], prompt, input });
  }

  try {
    const trabajos = [];
    for (const p of pedidos) {
      const { statusUrl, responseUrl } = await enviarAFal(p.modelo, p.input);
      trabajos.push(
        await prisma.trabajoIA.create({
          data: { productoId, tipo, modelo: p.modelo, prompt: p.prompt, statusUrl, responseUrl },
          select: { id: true, tipo: true, estado: true, error: true, createdAt: true, mediaId: true },
        })
      );
    }
    return NextResponse.json(trabajos, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo enviar a la IA." },
      { status: 400 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { maximoPorTipo } from "@/lib/media";
import { enviarAFal, estadoFal, falConfigurado, resultadoFal } from "@/lib/fal";
import {
  MODELO_FOTO,
  MODELO_VIDEO,
  promptFoto,
  promptVideo,
  type CalidadId,
  type EscenaId,
  type FormatoId,
  type PersonaId,
  type VideoTipoId,
} from "@/lib/estudio";

export const maxDuration = 60;

// Revisa los trabajos pendientes; los terminados se descargan, se guardan en
// Vercel Blob y quedan como foto/video IA pendiente de aprobación.
async function avanzarTrabajos(productoId: string) {
  const pendientes = await prisma.trabajoIA.findMany({
    where: { productoId, estado: "PENDIENTE" },
  });

  for (const t of pendientes) {
    try {
      const estado = await estadoFal(t.statusUrl);
      if (estado !== "COMPLETED") continue;

      const resultado = await resultadoFal(t.responseUrl);
      const url: string | undefined =
        t.tipo === "FOTO" ? resultado?.images?.[0]?.url : resultado?.video?.url;
      if (!url) throw new Error("La IA no devolvió ningún archivo.");

      const archivo = await fetch(url, { cache: "no-store" });
      if (!archivo.ok) throw new Error("No se pudo descargar el resultado de la IA.");
      const contentType =
        archivo.headers.get("content-type") || (t.tipo === "FOTO" ? "image/jpeg" : "video/mp4");
      const extension = t.tipo === "FOTO" ? "jpg" : "mp4";
      const datos = await archivo.arrayBuffer();

      const blob = await put(
        `productos/${productoId}/${t.tipo === "FOTO" ? "fotos" : "videos"}/ia-${t.id}.${extension}`,
        datos,
        { access: "public", addRandomSuffix: true, contentType }
      );

      const ultimo = await prisma.mediaProducto.findFirst({
        where: { productoId, tipo: t.tipo },
        orderBy: { orden: "desc" },
        select: { orden: true },
      });
      const media = await prisma.mediaProducto.create({
        data: {
          productoId,
          tipo: t.tipo,
          url: blob.url,
          pathname: blob.pathname,
          nombre: `IA ${t.tipo === "FOTO" ? "foto" : "video"}.${extension}`,
          tamano: datos.byteLength,
          orden: ultimo ? ultimo.orden + 1 : 0,
          origen: "IA",
          aprobado: false,
        },
      });

      await prisma.trabajoIA.update({
        where: { id: t.id },
        data: { estado: "LISTO", mediaId: media.id },
      });
    } catch (e) {
      await prisma.trabajoIA.update({
        where: { id: t.id },
        data: {
          estado: "ERROR",
          error: e instanceof Error ? e.message : "Falló la generación.",
        },
      });
    }
  }
}

// Lista los trabajos de IA de un producto (y avanza los pendientes).
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const productoId = req.nextUrl.searchParams.get("productoId");
  if (!productoId) return NextResponse.json({ error: "Falta el producto." }, { status: 400 });

  if (falConfigurado()) await avanzarTrabajos(productoId);

  const trabajos = await prisma.trabajoIA.findMany({
    where: { productoId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, tipo: true, estado: true, error: true, createdAt: true, mediaId: true },
  });
  return NextResponse.json(trabajos);
}

// Pide a la IA una foto o un video nuevo (modo automático).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  if (!falConfigurado()) {
    return NextResponse.json(
      { error: "El modo automático necesita la clave FAL_KEY en Vercel. Mientras tanto usá el modo gratis." },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    productoId?: string;
    tipo?: "FOTO" | "VIDEO";
    mediaIds?: string[];
    calidad?: CalidadId;
    escena?: EscenaId;
    escenaPersonalizada?: string;
    persona?: PersonaId;
    formato?: FormatoId;
    videoTipo?: VideoTipoId;
    duracion?: number;
    extra?: string;
  };

  const { productoId, tipo } = body;
  if (!productoId || (tipo !== "FOTO" && tipo !== "VIDEO")) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  const calidad: CalidadId = body.calidad === "premium" ? "premium" : "estandar";

  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: { id: true, nombre: true },
  });
  if (!producto) return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });

  // Respetamos los límites contando también lo que la IA está generando.
  const [existentes, enCurso] = await Promise.all([
    prisma.mediaProducto.count({ where: { productoId, tipo } }),
    prisma.trabajoIA.count({ where: { productoId, tipo, estado: "PENDIENTE" } }),
  ]);
  if (existentes + enCurso >= maximoPorTipo(tipo)) {
    return NextResponse.json(
      {
        error:
          tipo === "FOTO"
            ? "Ya llegaste al máximo de 20 fotos. Borrá alguna para generar más."
            : "Ya llegaste al máximo de 5 videos. Borrá alguno para generar más.",
      },
      { status: 400 }
    );
  }

  // Fotos de base: solo fotos del producto, en el orden elegido.
  const ids = Array.isArray(body.mediaIds) ? body.mediaIds : [];
  const base = await prisma.mediaProducto.findMany({
    where: { productoId, id: { in: ids }, tipo: "FOTO" },
    select: { id: true, url: true },
  });
  const urls = ids
    .map((id) => base.find((b) => b.id === id)?.url)
    .filter((u): u is string => Boolean(u));
  if (urls.length === 0) {
    return NextResponse.json({ error: "Elegí al menos una foto de base." }, { status: 400 });
  }

  const escena = body.escena || "estudio";
  const persona = body.persona || "ninguna";

  let modelo: string;
  let prompt: string;
  let input: Record<string, unknown>;

  if (tipo === "FOTO") {
    modelo = MODELO_FOTO[calidad];
    prompt = promptFoto({
      producto: producto.nombre,
      escena,
      escenaPersonalizada: body.escenaPersonalizada,
      persona,
      formato: body.formato || "4:5",
      extra: body.extra,
    });
    input = {
      prompt,
      image_urls: urls.slice(0, 4),
      num_images: 1,
      aspect_ratio: body.formato || "4:5",
      output_format: "jpeg",
    };
  } else {
    const videoTipo = body.videoTipo || "giro";
    if (videoTipo === "colores" && urls.length < 2) {
      return NextResponse.json(
        { error: "Para el cambio de color elegí 2 fotos en distintos colores." },
        { status: 400 }
      );
    }
    modelo = MODELO_VIDEO[calidad];
    prompt = promptVideo({
      producto: producto.nombre,
      tipo: videoTipo,
      escena,
      escenaPersonalizada: body.escenaPersonalizada,
      persona,
      extra: body.extra,
    });
    const duracion = body.duracion === 10 ? 10 : 5;
    input = {
      prompt,
      start_image_url: urls[0],
      duration: duracion,
      generate_audio: false,
      negative_prompt: "blur, distortion, deformed product, changed logo, extra text, watermark, low quality",
    };
    if (urls.length > 1) input.end_image_url = urls[urls.length - 1];
  }

  try {
    const { statusUrl, responseUrl } = await enviarAFal(modelo, input);
    const trabajo = await prisma.trabajoIA.create({
      data: { productoId, tipo, modelo, prompt, statusUrl, responseUrl },
      select: { id: true, tipo: true, estado: true, error: true, createdAt: true, mediaId: true },
    });
    return NextResponse.json(trabajo, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo enviar a la IA." },
      { status: 400 }
    );
  }
}
