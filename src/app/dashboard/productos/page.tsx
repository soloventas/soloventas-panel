import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function ProductosPage() {
  const productos = await prisma.producto.findMany({
    include: {
      variantes: true,
      categoria: true,
      media: {
        where: { tipo: "FOTO", aprobado: true },
        orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
        take: 1,
        select: { url: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-navy">
            Catálogo de productos
          </h1>
          <p className="text-sm text-gray-500">
            {productos.length} producto(s) cargado(s).
          </p>
        </div>
        <Link
          href="/dashboard/productos/nuevo"
          className="rounded-md bg-navy text-white text-sm font-semibold px-4 py-2 hover:opacity-90"
        >
          + Nuevo producto
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 w-16"></th>
              <th className="text-left px-4 py-3">Código</th>
              <th className="text-left px-4 py-3">Nombre</th>
              <th className="text-left px-4 py-3">Categoría</th>
              <th className="text-left px-4 py-3">Origen</th>
              <th className="text-right px-4 py-3">Precio</th>
              <th className="text-right px-4 py-3">Stock</th>
              <th className="text-left px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => {
              const usaVariantes = p.admiteColor || p.admiteTalle;
              const stockTotal = usaVariantes
                ? p.variantes.reduce((acc, v) => acc + v.stock, 0)
                : p.stock ?? 0;
              const simbolo = p.moneda === "USD" ? "US$" : "$";
              return (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/productos/${p.id}`} className="block w-12 h-12">
                      {p.media[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.media[0].url}
                          alt=""
                          loading="lazy"
                          className="w-12 h-12 rounded-md object-cover border border-gray-200"
                        />
                      ) : (
                        <span className="w-12 h-12 rounded-md border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-[10px] text-gray-400 text-center leading-tight">
                          Sin foto
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {p.codigo}
                  </td>
                  <td className="px-4 py-3">
                    {p.nombre}
                    {p.enOferta && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wide bg-gold/20 text-gold px-1.5 py-0.5 rounded">
                        Oferta
                      </span>
                    )}
                    {p.esNuevo && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wide bg-navy/10 text-navy px-1.5 py-0.5 rounded">
                        Nuevo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {p.categoria?.nombre || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {p.proveedor || "Propio"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {simbolo} {Number(p.precio).toLocaleString("es-AR")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {stockTotal}
                  </td>
                  <td className="px-4 py-3">
                    {p.activo ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        Activo
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/productos/${p.id}`}
                      className="text-navy text-sm font-medium hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              );
            })}
            {productos.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  Todavía no cargaste productos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
