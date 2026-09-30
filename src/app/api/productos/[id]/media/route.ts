import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { esUrlDeBlob, maximoPorTipo } from "@/lib/media";

// Lista las fotos y videos de un producto (portada primero).
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const media = await prisma.mediaProducto.findMany({
    where: { productoId: params.id },
    orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(media);
}

// Registra en la base un archivo que el navegador ya subió a Vercel Blob.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { url, pathname, tipo, nombre, tamano } = await req.json();

  if (!url || !pathname || (tipo !== "FOTO" && tipo !== "VIDEO") || !esUrlDeBlob(url)) {
    return NextResponse.json({ error: "Archivo inválido." }, { status: 400 });
  }

  const producto = await prisma.producto.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!producto) {
    await del(url).catch(() => {});
    return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
  }

  const cantidad = await prisma.mediaProducto.count({
    where: { productoId: params.id, tipo },
  });
  if (cantidad >= maximoPorTipo(tipo)) {
    // Se pasó del límite (por ejemplo, dos pestañas subiendo a la vez):
    // borramos el archivo para no dejarlo huérfano en el almacenamiento.
    await del(url).catch(() => {});
    return NextResponse.json(
      {
        error:
          tipo === "FOTO"
            ? `Máximo ${maximoPorTipo(tipo)} fotos por producto.`
            : `Máximo ${maximoPorTipo(tipo)} videos por producto.`,
      },
      { status: 400 }
    );
  }

  const ultimo = await prisma.mediaProducto.findFirst({
    where: { productoId: params.id, tipo },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });

  const media = await prisma.mediaProducto.create({
    data: {
      productoId: params.id,
      tipo,
      url,
      pathname,
      nombre: typeof nombre === "string" ? nombre.slice(0, 200) : null,
      tamano: typeof tamano === "number" ? Math.round(tamano) : null,
      orden: ultimo ? ultimo.orden + 1 : 0,
    },
  });

  return NextResponse.json(media, { status: 201 });
}
