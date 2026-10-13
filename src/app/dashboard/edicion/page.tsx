import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { iaConfigurada } from "@/lib/ia";
import { falConfigurado } from "@/lib/fal";
import { cfConfigurado } from "@/lib/cloudflare-ia";
import SeccionMedios from "../productos/[id]/seccion-medios";

// Edición de foto y video: elegís un producto del catálogo y desde acá
// mejorás sus fotos, armás videos con IA (gratis o paga) y lo publicás.
export default async function EdicionPage({
  searchParams,
}: {
  searchParams: { producto?: string; buscar?: string };
}) {
  const buscar = searchParams.buscar?.trim() || "";
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

  const elegido = searchParams.producto
    ? await prisma.producto.findUnique({
        where: { id: searchParams.producto },
        select: { id: true, nombre: true, codigo: true },
      })
    : null;

  let contenido = null;
  if (elegido) {
    const [media, cuentas] = await Promise.all([
      prisma.mediaProducto.findMany({
        where: { productoId: elegido.id },
        orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
        select: { id: true, tipo: true, url: true, nombre: true, origen: true, aprobado: true },
      }),
      prisma.integracionRed.findMany({
        where: { clave: { in: ["instagram", "facebook", "tiktok"] } },
        select: { clave: true, nombre: true },
      }),
    ]);
    const redes = {
      instagram: cuentas.find((c) => c.clave === "instagram")?.nombre ?? null,
      facebook: cuentas.find((c) => c.clave === "facebook")?.nombre ?? null,
      tiktok: cuentas.find((c) => c.clave === "tiktok")?.nombre ?? null,
    };
    contenido = (
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-navy">{elegido.nombre}</h2>
            <p className="text-sm text-gray-500 font-mono">{elegido.codigo}</p>
          </div>
          <Link href={`/dashboard/productos/${elegido.id}`} className="text-sm underline text-navy">
            Ver ficha del producto
          </Link>
        </div>
        <SeccionMedios
          key={elegido.id}
          productoId={elegido.id}
          producto={elegido.nombre}
          inicial={media}
          redes={redes}
          iaActiva={iaConfigurada()}
          falActivo={falConfigurado()}
          cfActivo={cfConfigurado()}
        />
      </div>
    );
  }

  const enlace = (id: string) =>
    `/dashboard/edicion?producto=${id}${buscar ? `&buscar=${encodeURIComponent(buscar)}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Edición de foto y video</h1>
        <p className="text-sm text-gray-500">
          Elegí un producto y mejorá sus fotos, creá videos o armá la publicación con la IA que
          quieras: gratis o paga. Las marcadas con ⭐ son las que mejor dejan el producto para vender.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
        <form className="flex gap-2">
          {searchParams.producto && (
            <input type="hidden" name="producto" value={searchParams.producto} />
          )}
          <input
            name="buscar"
            defaultValue={buscar}
            placeholder="Buscar producto por nombre o código"
            className="flex-1 min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy"
          />
          <button className="rounded-md bg-navy text-white text-sm font-semibold px-4 py-2 hover:opacity-90">
            Buscar
          </button>
        </form>
        {productos.length === 0 ? (
          <p className="text-sm text-gray-600">
            No hay productos{buscar ? " con esa búsqueda" : ""}.{" "}
            <Link href="/dashboard/productos/nuevo" className="underline">
              Cargá uno nuevo
            </Link>
            .
          </p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {productos.map((p) => {
              const activo = elegido?.id === p.id;
              return (
                <Link
                  key={p.id}
                  href={enlace(p.id)}
                  className={`shrink-0 w-24 rounded-lg border-2 overflow-hidden text-left ${
                    activo ? "border-navy" : "border-transparent hover:border-gray-300"
                  }`}
                >
                  {p.media[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.media[0].url} alt="" className="w-full aspect-square object-cover" />
                  ) : (
                    <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-[11px] text-gray-400">
                      Sin foto
                    </div>
                  )}
                  <p className="text-[11px] leading-tight px-1 py-1 line-clamp-2">{p.nombre}</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {contenido ?? (
        <p className="text-sm text-gray-600">
          Tocá un producto de la lista para empezar a editar sus fotos y videos.
        </p>
      )}
    </div>
  );
}
