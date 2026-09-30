import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

type Params = { params: { id: string; mediaId: string } };

// Acciones sobre una foto o video: "portada" (lo pone primero) o
// "aprobar" (habilita para publicar algo generado con IA).
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { accion } = await req.json().catch(() => ({ accion: null }));
  if (accion !== "portada" && accion !== "aprobar") {
    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  }

  const media = await prisma.mediaProducto.findFirst({
    where: { id: params.mediaId, productoId: params.id },
  });
  if (!media) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  if (accion === "aprobar") {
    const aprobado = await prisma.mediaProducto.update({
      where: { id: media.id },
      data: { aprobado: true },
    });
    return NextResponse.json(aprobado);
  }

  if (!media.aprobado) {
    return NextResponse.json(
      { error: "Primero aprobá esta foto para poder usarla de portada." },
      { status: 400 }
    );
  }

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
