import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Sirve una foto aprobada de un producto desde el dominio del panel.
// TikTok solo descarga fotos de un dominio verificado por la app, y las fotos
// están guardadas en Vercel Blob; esta ruta hace de puente.
// Solo entrega fotos que estén cargadas y aprobadas en el panel.
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return NextResponse.json({ error: "Falta la foto." }, { status: 400 });

  const media = await prisma.mediaProducto.findFirst({
    where: { url: u, tipo: "FOTO", aprobado: true },
    select: { url: true },
  });
  if (!media) return NextResponse.json({ error: "No encontrada." }, { status: 404 });

  const archivo = await fetch(media.url, { cache: "no-store" });
  if (!archivo.ok || !archivo.body) {
    return NextResponse.json({ error: "No se pudo leer la foto." }, { status: 502 });
  }
  return new NextResponse(archivo.body, {
    headers: {
      "Content-Type": archivo.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
