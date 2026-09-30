import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  TIPOS_FOTO,
  TIPOS_VIDEO,
  maximoPorTipo,
  bytesMaximosPorTipo,
  type TipoMedia,
} from "@/lib/media";

// Entrega al navegador un permiso temporal para subir UNA foto o video
// directo a Vercel Blob. Antes de darlo, verifica la sesión y los límites.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const session = await getSession();
        if (!session) throw new Error("No autorizado.");

        const { productoId, tipo } = JSON.parse(clientPayload || "{}") as {
          productoId?: string;
          tipo?: TipoMedia;
        };
        if (!productoId || (tipo !== "FOTO" && tipo !== "VIDEO")) {
          throw new Error("Datos de subida inválidos.");
        }

        const producto = await prisma.producto.findUnique({
          where: { id: productoId },
          select: { id: true },
        });
        if (!producto) throw new Error("Producto no encontrado.");

        const cantidad = await prisma.mediaProducto.count({
          where: { productoId, tipo },
        });
        const max = maximoPorTipo(tipo);
        if (cantidad >= max) {
          throw new Error(
            tipo === "FOTO"
              ? `Este producto ya tiene el máximo de ${max} fotos.`
              : `Este producto ya tiene el máximo de ${max} videos.`
          );
        }

        return {
          allowedContentTypes: tipo === "FOTO" ? TIPOS_FOTO : TIPOS_VIDEO,
          maximumSizeInBytes: bytesMaximosPorTipo(tipo),
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ productoId, tipo }),
        };
      },
      onUploadCompleted: async () => {
        // El panel registra el archivo en la base apenas termina la subida
        // (POST /api/productos/[id]/media), así no dependemos de este aviso.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
