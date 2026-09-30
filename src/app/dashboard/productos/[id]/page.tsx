import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EditarProductoForm from "./editar-form";
import SeccionMedios from "./seccion-medios";
import { iaConfigurada } from "@/lib/ia";
import { falConfigurado } from "@/lib/fal";

export default async function EditarProductoPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { nuevo?: string };
}) {
  const producto = await prisma.producto.findUnique({
    where: { id: params.id },
    include: {
      variantes: { include: { color: true, talle: true } },
      categoria: true,
    },
  });

  if (!producto) notFound();

  const media = await prisma.mediaProducto.findMany({
    where: { productoId: producto.id },
    orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
    select: { id: true, tipo: true, url: true, nombre: true, origen: true, aprobado: true },
  });

  const cuentas = await prisma.integracionRed.findMany({
    where: { clave: { in: ["instagram", "facebook"] } },
    select: { clave: true, nombre: true },
  });
  const redes = {
    instagram: cuentas.find((c) => c.clave === "instagram")?.nombre ?? null,
    facebook: cuentas.find((c) => c.clave === "facebook")?.nombre ?? null,
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-navy mb-1">
        {producto.nombre}
      </h1>
      <p className="text-sm text-gray-500 mb-6 font-mono">{producto.codigo}</p>

      {searchParams.nuevo && (
        <div className="mb-5 rounded-md bg-green-50 text-green-800 text-sm px-4 py-3">
          Producto creado. Ahora cargale sus fotos y videos.
        </div>
      )}

      <div className="mb-5">
        <SeccionMedios
          productoId={producto.id}
          inicial={media}
          redes={redes}
          iaActiva={iaConfigurada()}
          falActivo={falConfigurado()}
          producto={producto.nombre}
        />
      </div>
      <EditarProductoForm
        producto={{
          id: producto.id,
          codigo: producto.codigo,
          nombre: producto.nombre,
          descripcion: producto.descripcion ?? "",
          categoriaId: producto.categoriaId ?? "",
          proveedor: producto.proveedor ?? "",
          precioCosto: producto.precioCosto ? String(producto.precioCosto) : "",
          gananciaPorcentaje: producto.gananciaPorcentaje
            ? String(producto.gananciaPorcentaje)
            : "",
          precio: Number(producto.precio),
          moneda: producto.moneda,
          admiteColor: producto.admiteColor,
          admiteTalle: producto.admiteTalle,
          stock: producto.stock ?? 0,
          compraMinima: String(producto.compraMinima),
          descuentoCantidadMinima:
            producto.descuentoCantidadMinima != null
              ? String(producto.descuentoCantidadMinima)
              : "",
          descuentoPorcentaje: producto.descuentoPorcentaje
            ? String(producto.descuentoPorcentaje)
            : "",
          visibleSinRegistrarse: producto.visibleSinRegistrarse,
          enOferta: producto.enOferta,
          esNuevo: producto.esNuevo,
          activo: producto.activo,
        }}
        variantes={producto.variantes.map((v) => ({
          colorId: v.colorId ?? "",
          talleId: v.talleId ?? "",
          stock: v.stock,
        }))}
      />
    </div>
  );
}
