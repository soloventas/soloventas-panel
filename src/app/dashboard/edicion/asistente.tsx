"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Media } from "../productos/[id]/media-manager";
import SeccionMedios from "../productos/[id]/seccion-medios";
import ConectarIAs from "./conectar-ias";
import Navegacion from "./navegacion";
import { PASOS } from "./pasos";

export type ProductoLista = { id: string; nombre: string; codigo: string; foto: string | null };

export default function Asistente({
  pasoInicial,
  cfActivo,
  falActivo,
  iaActiva,
  productos,
  buscar,
  elegido,
}: {
  pasoInicial: number;
  cfActivo: boolean;
  falActivo: boolean;
  iaActiva: boolean;
  productos: ProductoLista[];
  buscar: string;
  elegido: {
    id: string;
    nombre: string;
    codigo: string;
    descripcion: string | null;
    media: Media[];
    redes: { instagram: string | null; facebook: string | null; tiktok: string | null };
  } | null;
}) {
  const [paso, setPaso] = useState(pasoInicial);
  const [alcanzado, setAlcanzado] = useState(pasoInicial);

  function irA(p: number) {
    setPaso(p);
    setAlcanzado((a) => Math.max(a, p));
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [paso]);

  const enlace = (id: string) =>
    `/dashboard/edicion?producto=${id}&paso=2${buscar ? `&buscar=${encodeURIComponent(buscar)}` : ""}`;

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      {/* Barra con los 8 pasos */}
      <ol className="flex flex-wrap gap-1.5">
        {PASOS.map((p, i) => {
          const n = i + 1;
          const activo = n === paso;
          const hecho = n < paso;
          const puede = n <= alcanzado && (n <= 2 || elegido);
          return (
            <li key={p.titulo} className="shrink-0">
              <button
                type="button"
                onClick={() => puede && irA(n)}
                disabled={!puede}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap ${
                  activo
                    ? "bg-navy text-white border-navy"
                    : hecho
                    ? "bg-navy/5 text-navy border-navy/30"
                    : "bg-white text-gray-400 border-gray-200"
                } ${puede && !activo ? "hover:border-navy" : ""}`}
              >
                <span className="font-bold">{hecho ? "✓" : n}</span>
                {p.titulo}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gold">
            Paso {paso} de {PASOS.length}
          </p>
          <h2 className="text-xl font-semibold text-navy">{PASOS[paso - 1].titulo}</h2>
          <p className="text-sm text-gray-600 mt-0.5">{PASOS[paso - 1].ayuda}</p>
          {elegido && paso >= 3 && (
            <p className="text-xs text-gray-500 mt-1">
              Producto: <b className="text-gray-800">{elegido.nombre}</b>{" "}
              <span className="font-mono">{elegido.codigo}</span> ·{" "}
              <button type="button" onClick={() => irA(2)} className="underline">
                cambiar
              </button>
            </p>
          )}
        </div>

        {paso === 1 && (
          <>
            <ConectarIAs cf={cfActivo} fal={falActivo} />
            <Navegacion
              onSiguiente={() => irA(2)}
              aviso={
                cfActivo
                  ? null
                  : "Sin la IA gratis conectada solo vas a poder armar videos con tus fotos."
              }
            />
          </>
        )}

        {paso === 2 && (
          <>
            <form className="flex gap-2">
              {elegido && <input type="hidden" name="producto" value={elegido.id} />}
              <input type="hidden" name="paso" value="2" />
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
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-[28rem] overflow-y-auto">
                {productos.map((p) => {
                  const activo = elegido?.id === p.id;
                  return (
                    <Link
                      key={p.id}
                      href={enlace(p.id)}
                      scroll={false}
                      className={`relative rounded-lg border-2 overflow-hidden text-left ${
                        activo ? "border-navy bg-navy/5" : "border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {p.foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.foto} alt="" className="w-full aspect-square object-cover" />
                      ) : (
                        <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-[11px] text-gray-400">
                          Sin foto
                        </div>
                      )}
                      {activo && (
                        <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-navy text-white text-[11px] font-bold flex items-center justify-center">
                          ✓
                        </span>
                      )}
                      <p className="text-[11px] leading-tight px-1 py-1 line-clamp-2">{p.nombre}</p>
                    </Link>
                  );
                })}
              </div>
            )}
            {elegido && (
              <p className="text-sm text-gray-700">
                Elegiste: <b>{elegido.nombre}</b>{" "}
                <Link href={`/dashboard/productos/${elegido.id}`} className="text-xs underline text-navy">
                  ver ficha
                </Link>
              </p>
            )}
            <Navegacion
              onAtras={() => irA(1)}
              onSiguiente={() => irA(3)}
              deshabilitado={!elegido}
              aviso={elegido ? null : "Tocá un producto para seguir."}
            />
          </>
        )}

        {/* Queda armado aunque vuelvas a los pasos 1 y 2, así no se pierde lo elegido. */}
        {elegido && (
          <div className={paso >= 3 ? "" : "hidden"}>
            <SeccionMedios
              key={elegido.id}
              productoId={elegido.id}
              producto={elegido.nombre}
              descripcion={elegido.descripcion ?? ""}
              inicial={elegido.media}
              redes={elegido.redes}
              iaActiva={iaActiva}
              falActivo={falActivo}
              cfActivo={cfActivo}
              paso={paso}
              irA={irA}
            />
          </div>
        )}
      </div>
    </div>
  );
}
