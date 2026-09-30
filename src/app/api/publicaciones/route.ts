import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  avanzarInstagram,
  crearPublicacion,
  MAX_CARRUSEL,
  MAX_TEXTO_INSTAGRAM,
  type FormatoPub,
  type RedPub,
} from "@/lib/publicar";

// Instagram puede tardar en procesar videos: damos margen a la función.
export const maxDuration = 60;

// Historial de publicaciones de un producto (y avanza las que están procesando).
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const productoId = req.nextUrl.searchParams.get("productoId");
  if (!productoId) return NextResponse.json({ error: "Falta el producto." }, { status: 400 });

  const pendientes = await prisma.publicacion.findMany({
    where: { productoId, estado: "PROCESANDO", red: "INSTAGRAM" },
    select: { id: true },
  });
  for (const p of pendientes) await avanzarInstagram(p.id);

  const publicaciones = await prisma.publicacion.findMany({
    where: { productoId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return NextResponse.json(publicaciones);
}

// Publica un producto en una o varias redes.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { productoId, redes, formato, mediaIds, texto } = (await req.json().catch(() => ({}))) as {
    productoId?: string;
    redes?: RedPub[];
    formato?: FormatoPub;
    mediaIds?: string[];
    texto?: string;
  };

  const redesValidas = (redes || []).filter((r) => r === "INSTAGRAM" || r === "FACEBOOK");
  if (!productoId || redesValidas.length === 0) {
    return NextResponse.json({ error: "Elegí al menos una red." }, { status: 400 });
  }
  if (formato !== "FOTO" && formato !== "CARRUSEL" && formato !== "VIDEO") {
    return NextResponse.json({ error: "Formato inválido." }, { status: 400 });
  }
  const textoFinal = (texto || "").trim();
  if (!textoFinal) {
    return NextResponse.json({ error: "Escribí o generá el texto de la publicación." }, { status: 400 });
  }
  if (redesValidas.includes("INSTAGRAM") && textoFinal.length > MAX_TEXTO_INSTAGRAM) {
    return NextResponse.json(
      { error: `Instagram admite hasta ${MAX_TEXTO_INSTAGRAM} caracteres de texto.` },
      { status: 400 }
    );
  }

  // Tomamos los archivos en el orden elegido y verificamos que sean del producto.
  const ids = Array.isArray(mediaIds) ? mediaIds : [];
  const media = await prisma.mediaProducto.findMany({
    where: { productoId, id: { in: ids }, aprobado: true },
  });
  const ordenados = ids
    .map((id) => media.find((m) => m.id === id))
    .filter((m): m is (typeof media)[number] => Boolean(m));

  const fotos = ordenados.filter((m) => m.tipo === "FOTO");
  const videos = ordenados.filter((m) => m.tipo === "VIDEO");

  if (formato === "FOTO" && (fotos.length !== 1 || videos.length > 0)) {
    return NextResponse.json({ error: "Para una foto sola, elegí exactamente 1 foto." }, { status: 400 });
  }
  if (formato === "CARRUSEL" && (fotos.length < 2 || fotos.length > MAX_CARRUSEL || videos.length > 0)) {
    return NextResponse.json(
      { error: `Para un carrusel elegí entre 2 y ${MAX_CARRUSEL} fotos.` },
      { status: 400 }
    );
  }
  if (formato === "VIDEO" && (videos.length !== 1 || fotos.length > 0)) {
    return NextResponse.json({ error: "Para un video/Reel, elegí exactamente 1 video." }, { status: 400 });
  }

  const urls = ordenados.map((m) => m.url);
  const resultados = [];
  for (const red of redesValidas) {
    resultados.push(
      await crearPublicacion({ productoId, red, formato, urls, texto: textoFinal })
    );
  }
  return NextResponse.json(resultados, { status: 201 });
}
