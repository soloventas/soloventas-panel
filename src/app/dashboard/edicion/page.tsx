import { prisma } from "@/lib/prisma";
import { iaConfigurada } from "@/lib/ia";
import { falConfigurado } from "@/lib/fal";
import { cfConfigurado } from "@/lib/cloudflare-ia";
import Asistente from "./asistente";
import { PASOS } from "./pasos";

// Edición de foto y video, paso a paso: conectar IAs, elegir producto, fotos,
// qué hacer, IA, observaciones, ver el resultado y publicarlo en las redes.
export default async function EdicionPage({
  searchParams,
}: {
  searchParams: { producto?: string; buscar?: string; paso?: string };
}) {
  const buscar = searchParams.buscar?.trim() || "";
  const [cfActivo, falActivo] = await Promise.all([cfConfigurado(), falConfigurado()]);
  const productos = await prisma.producto.findMany({
    where: buscar
      ? {
          OR: [
            { nombre: { contains: buscar, mode: "insensitive" } },
            { codigo: { contains: buscar, mode: "insensitive" } },
          ],
        }
      : undefined,
    select: {
      id: true,
      nombre: true,
      codigo: true,
      media: {
        where: { tipo: "FOTO", aprobado: true },
        orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
        take: 1,
        select: { url: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  const producto = searchParams.producto
    ? await prisma.producto.findUnique({
        where: { id: searchParams.producto },
        select: { id: true, nombre: true, codigo: true },
      })
    : null;

  let elegido = null;
  if (producto) {
    const [media, cuentas] = await Promise.all([
      prisma.mediaProducto.findMany({
        where: { productoId: producto.id },
        orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
        select: { id: true, tipo: true, url: true, nombre: true, origen: true, aprobado: true },
      }),
      prisma.integracionRed.findMany({
        where: { clave: { in: ["instagram", "facebook", "tiktok"] } },
        select: { clave: true, nombre: true },
      }),
    ]);
    elegido = {
      ...producto,
      media,
      redes: {
        instagram: cuentas.find((c) => c.clave === "instagram")?.nombre ?? null,
        facebook: cuentas.find((c) => c.clave === "facebook")?.nombre ?? null,
        tiktok: cuentas.find((c) => c.clave === "tiktok")?.nombre ?? null,
      },
    };
  }

  // Sin producto se arranca en el paso 1; con producto, en el paso de las fotos.
  const pedido = Number(searchParams.paso);
  const pasoInicial =
    pedido >= 1 && pedido <= PASOS.length && (pedido <= 2 || elegido) ? pedido : elegido ? 3 : 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Edición de foto y video</h1>
        <p className="text-sm text-gray-500">
          Seguí los pasos y tocá Siguiente: en 8 pantallas pasás de tus fotos a la publicación en
          las redes. Todo se hace acá mismo.
        </p>
      </div>

      <Asistente
        pasoInicial={pasoInicial}
        cfActivo={cfActivo}
        falActivo={falActivo}
        iaActiva={iaConfigurada()}
        productos={productos.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          codigo: p.codigo,
          foto: p.media[0]?.url ?? null,
        }))}
        buscar={buscar}
        elegido={elegido}
      />
    </div>
  );
}
