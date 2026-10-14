import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { maximoPorTipo } from "@/lib/media";
import { buscarModeloGratis, cfConfigurado, generarFotoGratis } from "@/lib/cloudflare-ia";
import {
  promptsFotos,
  limpiarEstilos,
  limpiarTexto,
  fichaDe,
  type EscenaId,
  type FormatoId,
  type FotoTipoId,
  type PersonaId,
  type TextoPosId,
} from "@/lib/estudio";

export const maxDuration = 60;

const SELECCION = { id: true, tipo: true, estado: true, error: true, createdAt: true, mediaId: true };

async function siguienteOrden(productoId: string, tipo: "FOTO" | "VIDEO") {
  const ultimo = await prisma.mediaProducto.findFirst({
    where: { productoId, tipo },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });
  return ultimo ? ultimo.orden + 1 : 0;
}

// IA gratis dentro del panel.
// - multipart (datos + ref_0..ref_3): genera fotos con FLUX.2 Klein (Cloudflare).
// - JSON { accion: "registrar", productoId, mediaId }: anota un video armado en
//   el navegador para que aparezca en "Así quedó".
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  if ((req.headers.get("content-type") || "").includes("application/json")) {
    const { accion, productoId, mediaId } = await req.json().catch(() => ({}));
    if (accion !== "registrar" || !productoId || !mediaId) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }
    const media = await prisma.mediaProducto.findFirst({
      where: { id: mediaId, productoId },
      select: { id: true, tipo: true },
    });
    if (!media) return NextResponse.json({ error: "No se encontró el archivo." }, { status: 404 });
    const trabajo = await prisma.trabajoIA.create({
      data: {
        productoId,
        tipo: media.tipo,
        modelo: "video-gratis-navegador",
        prompt: "Video armado con las fotos del producto",
        statusUrl: "",
        responseUrl: "",
        estado: "LISTO",
        mediaId: media.id,
      },
      select: SELECCION,
    });
    return NextResponse.json(trabajo, { status: 201 });
  }

  if (!(await cfConfigurado())) {
    return NextResponse.json(
      { error: "Falta conectar la IA gratis (Cloudflare) en Vercel." },
      { status: 400 }
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  const body = JSON.parse(String(form.get("datos") || "{}")) as {
    productoId?: string;
    modeloId?: string;
    fotoTipo?: FotoTipoId;
    escena?: EscenaId;
    escenaPersonalizada?: string;
    persona?: PersonaId;
    formato?: FormatoId;
    extra?: string;
    texto?: string;
    textoPos?: TextoPosId;
    estilos?: string[];
    // "Más como esta": nuevas versiones a partir de un resultado anterior.
    variarDe?: string;
  };
  const { productoId } = body;
  if (!productoId) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  const referencias: Blob[] = [];
  for (let i = 0; i < 4; i++) {
    const f = form.get(`ref_${i}`);
    if (f && typeof f !== "string") referencias.push(f);
  }
  if (referencias.length === 0) {
    return NextResponse.json({ error: "Elegí al menos una foto de base." }, { status: 400 });
  }

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

  // Variaciones de un resultado: mismo pedido, otra composición. El resultado
  // viene como primera referencia y las fotos reales del producto después.
  let base: { prompt: string } | null = null;
  if (body.variarDe) {
    base = await prisma.trabajoIA.findFirst({
      where: { id: body.variarDe, productoId, tipo: "FOTO" },
      select: { prompt: true },
    });
    if (!base) return NextResponse.json({ error: "No se encontró esa versión." }, { status: 404 });
  }

  const fotoTipo: FotoTipoId =
    body.fotoTipo === "escena" || body.fotoTipo === "catalogo" || body.fotoTipo === "mejorar"
      ? body.fotoTipo
      : "pack";
  const formato: FormatoId = body.formato === "1:1" || body.formato === "9:16" ? body.formato : "4:5";
  const prompts = base
    ? [1, 2].map(() => ({
        titulo: "Más como esta",
        prompt: `Create a fresh alternative version of the first reference image: keep the same advertising style, mood and color palette, but change the composition, camera angle, pose and layout so it looks like a new option. The product must stay identical to the real product photos. ${base!.prompt}`,
      }))
    : promptsFotos(fotoTipo, {
    producto: producto.nombre,
    ficha: fichaDe(producto),
    escena: body.escena || "estudio",
    escenaPersonalizada: body.escenaPersonalizada,
    persona: body.persona || "ninguna",
    formato,
    extra: body.extra,
    texto: limpiarTexto(body.texto),
    textoPos: body.textoPos === "abajo" ? "abajo" : "arriba",
    estilos: limpiarEstilos(body.estilos),
  });

  const existentes = await prisma.mediaProducto.count({ where: { productoId, tipo: "FOTO" } });
  if (existentes + prompts.length > maximoPorTipo("FOTO")) {
    return NextResponse.json(
      { error: "No hay lugar para más fotos (máximo 20). Borrá alguna para generar más." },
      { status: 400 }
    );
  }

  const modelo = buscarModeloGratis(body.modeloId);
  const trabajos = [];
  for (const p of prompts) {
    try {
      const { datos, contentType } = await generarFotoGratis(modelo, p.prompt, referencias, formato);
      const extension = contentType === "image/png" ? "png" : "jpg";
      const blob = await put(`productos/${productoId}/fotos/ia-gratis.${extension}`, datos, {
        access: "public",
        addRandomSuffix: true,
        contentType,
      });
      const media = await prisma.mediaProducto.create({
        data: {
          productoId,
          tipo: "FOTO",
          url: blob.url,
          pathname: blob.pathname,
          nombre: `IA foto.${extension}`,
          tamano: datos.byteLength,
          orden: await siguienteOrden(productoId, "FOTO"),
          origen: "IA",
          aprobado: false,
        },
      });
      trabajos.push(
        await prisma.trabajoIA.create({
          data: {
            productoId,
            tipo: "FOTO",
            modelo: modelo.modelo,
            // En las variaciones guardamos el pedido original para poder seguir variando.
            prompt: base ? base.prompt : p.prompt,
            statusUrl: "",
            responseUrl: "",
            estado: "LISTO",
            mediaId: media.id,
          },
          select: SELECCION,
        })
      );
    } catch (e) {
      // Si ya salió alguna, la devolvemos igual y avisamos del resto.
      const mensaje = e instanceof Error ? e.message : "La IA gratis no pudo generar la foto.";
      if (trabajos.length === 0) return NextResponse.json({ error: mensaje }, { status: 400 });
      return NextResponse.json({ trabajos, aviso: mensaje }, { status: 201 });
    }
  }
  return NextResponse.json({ trabajos }, { status: 201 });
}
