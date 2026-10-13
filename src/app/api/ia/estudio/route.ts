import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { maximoPorTipo } from "@/lib/media";
import { enviarAFal, estadoFal, falConfigurado, resultadoFal } from "@/lib/fal";
import {
  promptVideo,
  promptsFotos,
  limpiarEstilos,
  limpiarTexto,
  fichaDe,
  type TextoPosId,
  type CalidadId,
  type FotoTipoId,
  type EscenaId,
  type FormatoId,
  type PersonaId,
  type VideoTipoId,
} from "@/lib/estudio";
import { buscarModelo } from "@/lib/proveedores-ia";

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
    take: 40,
    select: { id: true, tipo: true, estado: true, error: true, createdAt: true, mediaId: true, modelo: true },
  });
  // Sumamos la foto/video resultante para mostrar la vista previa.
  const ids = trabajos.map((t) => t.mediaId).filter((id): id is string => Boolean(id));
  const medias = ids.length
    ? await prisma.mediaProducto.findMany({
        where: { id: { in: ids } },
        select: { id: true, url: true, tipo: true, aprobado: true },
      })
    : [];
  return NextResponse.json(
    trabajos.map((t) => ({ ...t, media: medias.find((m) => m.id === t.mediaId) ?? null }))
  );
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
    modeloId?: string;
    fotoTipo?: FotoTipoId;
    escena?: EscenaId;
    escenaPersonalizada?: string;
    persona?: PersonaId;
    formato?: FormatoId;
    videoTipo?: VideoTipoId;
    duracion?: number;
    extra?: string;
    texto?: string;
    textoPos?: TextoPosId;
    estilos?: string[];
  };

  const { productoId, tipo } = body;
  if (!productoId || (tipo !== "FOTO" && tipo !== "VIDEO")) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  const modelo = buscarModelo(tipo, body.modeloId, body.calidad);

  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      variantes: { select: { color: { select: { nombre: true } }, talle: { select: { nombre: true } } } },
    },
  });
  if (!producto) return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });

  // Respetamos los límites contando también lo que la IA está generando.
  const [existentes, enCurso] = await Promise.all([
    prisma.mediaProducto.count({ where: { productoId, tipo } }),
    prisma.trabajoIA.count({ where: { productoId, tipo, estado: "PENDIENTE" } }),
  ]);
  const fotoTipo: FotoTipoId =
    body.fotoTipo === "escena" || body.fotoTipo === "catalogo" || body.fotoTipo === "mejorar"
      ? body.fotoTipo
      : "pack";
  // El pack sale de a 2 fotos (producto real + con modelo).
  // Pack: producto real + una foto con modelo por estilo; escena: una por estilo.
  const cantidadEstilos = limpiarEstilos(body.estilos).length;
  const nuevos =
    tipo !== "FOTO"
      ? 1
      : fotoTipo === "pack"
      ? 1 + cantidadEstilos
      : fotoTipo === "escena"
      ? cantidadEstilos
      : 1;
  if (existentes + enCurso + nuevos > maximoPorTipo(tipo)) {
    return NextResponse.json(
      {
        error:
          tipo === "FOTO"
            ? `No hay lugar para ${nuevos > 1 ? `${nuevos} fotos más` : "otra foto"} (máximo 20). Borrá alguna para generar más.`
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

  const pedidos: { prompt: string; input: Record<string, unknown> }[] = [];
  const formato = body.formato || "4:5";
  const duracion = body.duracion === 10 ? 10 : 5;
  const texto = limpiarTexto(body.texto);
  const textoPos: TextoPosId = body.textoPos === "abajo" ? "abajo" : "arriba";
  const conTexto = Boolean(texto);

  if (tipo === "FOTO") {
    const pack = promptsFotos(fotoTipo, {
      producto: producto.nombre,
      ficha: fichaDe(producto),
      escena,
      escenaPersonalizada: body.escenaPersonalizada,
      persona,
      formato,
      extra: body.extra,
      texto,
      textoPos,
      estilos: limpiarEstilos(body.estilos),
    });
    for (const p of pack) {
      pedidos.push({
        prompt: p.prompt,
        input: modelo.armar({ prompt: p.prompt, urls, formato, duracion, conTexto: conTexto || Boolean(p.conTexto) }),
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
      texto,
      textoPos,
    });
    pedidos.push({ prompt, input: modelo.armar({ prompt, urls, formato, duracion, conTexto }) });
  }

  try {
    const trabajos = [];
    for (const p of pedidos) {
      const { statusUrl, responseUrl } = await enviarAFal(modelo.endpoint, p.input);
      trabajos.push(
        await prisma.trabajoIA.create({
          data: { productoId, tipo, modelo: modelo.endpoint, prompt: p.prompt, statusUrl, responseUrl },
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
