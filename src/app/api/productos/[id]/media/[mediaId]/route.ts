import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

type Params = { params: { id: string; mediaId: string } };

// Marca una foto o video como el primero (portada).
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { accion } = await req.json().catch(() => ({ accion: null }));
  if (accion !== "portada") {
    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  }

  const media = await prisma.mediaProducto.findFirst({
    where: { id: params.mediaId, productoId: params.id },
  });
  if (!media) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  const primero = await prisma.mediaProducto.findFirst({
    where: { productoId: params.id, tipo: media.tipo },
    orderBy: { orden: "asc" },
    select: { orden: true },
  });

  const actualizado = await prisma.mediaProducto.update({
    where: { id: media.id },
    data: { orden: (primero?.orden ?? 0) - 1 },
  });
  return NextResponse.json(actualizado);
}

// Elimina la foto o video del almacenamiento y de la base.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const media = await prisma.mediaProducto.findFirst({
    where: { id: params.mediaId, productoId: params.id },
  });
  if (!media) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  await del(media.url).catch(() => {});
  await prisma.mediaProducto.delete({ where: { id: media.id } });
  return NextResponse.json({ ok: true });
}
