"use client";

import { useEffect, useState } from "react";

// Opciones que TikTok exige mostrar antes de publicar: la cuenta, quién puede
// verlo (sin valor por defecto), interacciones, contenido comercial y el aviso
// de sus políticas.

export type Privacidad =
  | "PUBLIC_TO_EVERYONE"
  | "MUTUAL_FOLLOW_FRIENDS"
  | "FOLLOWER_OF_CREATOR"
  | "SELF_ONLY";

export type OpcionesTikTok = {
  modo: "DIRECTO" | "BORRADOR";
  privacidad?: Privacidad;
  permitirComentarios: boolean;
  permitirDuo: boolean;
  permitirStitch: boolean;
  contenidoComercial: boolean;
  marcaPropia: boolean;
  contenidoPatrocinado: boolean;
};

export type Creador = {
  nombre: string;
  usuario: string;
  avatar: string;
  privacidades: Privacidad[];
  comentariosDesactivados: boolean;
  duoDesactivado: boolean;
  stitchDesactivado: boolean;
  duracionMaxima: number;
};

export const OPCIONES_TIKTOK_INICIALES: OpcionesTikTok = {
  modo: "DIRECTO",
  permitirComentarios: false,
  permitirDuo: false,
  permitirStitch: false,
  contenidoComercial: false,
  marcaPropia: false,
  contenidoPatrocinado: false,
};

const NOMBRE_PRIVACIDAD: Record<Privacidad, string> = {
  PUBLIC_TO_EVERYONE: "Todo el mundo",
  MUTUAL_FOLLOW_FRIENDS: "Amigos",
  FOLLOWER_OF_CREATOR: "Seguidores",
  SELF_ONLY: "Solo yo",
};

// Problema a resolver antes de poder publicar en TikTok (o null si está todo bien).
export function problemaTikTok(
  op: OpcionesTikTok,
  creador: Creador | null,
  duracionVideo: number | null
) {
  if (!creador) return "Esperá a que cargue tu cuenta de TikTok.";
  if (duracionVideo && creador.duracionMaxima && duracionVideo > creador.duracionMaxima) {
    return `TikTok permite videos de hasta ${creador.duracionMaxima} segundos en tu cuenta.`;
  }
  if (op.modo === "BORRADOR") return null;
  if (!op.privacidad) return "Elegí quién puede ver la publicación en TikTok.";
  if (op.contenidoComercial && !op.marcaPropia && !op.contenidoPatrocinado) {
    return "Indicá si el contenido comercial promociona tu marca o a un tercero.";
  }
  return null;
}

export default function TikTokOpciones({
  opciones,
  onCambio,
  creador,
  onCreador,
  esVideo = true,
}: {
  esVideo?: boolean;
  opciones: OpcionesTikTok;
  onCambio: (o: OpcionesTikTok) => void;
  creador: Creador | null;
  onCreador: (c: Creador | null) => void;
}) {
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await fetch("/api/tiktok/creador", { cache: "no-store" });
      const data = await r.json().catch(() => ({}));
      if (!vivo) return;
      if (!r.ok) {
        setError(data.error || "No se pudo consultar tu cuenta de TikTok.");
        onCreador(null);
        return;
      }
      onCreador(data);
    })();
    return () => {
      vivo = false;
    };
  }, [onCreador]);

  const set = (cambios: Partial<OpcionesTikTok>) => onCambio({ ...opciones, ...cambios });

  if (error) return <p className="text-sm text-red-600">TikTok: {error}</p>;
  if (!creador) return <p className="text-sm text-gray-500">Cargando tu cuenta de TikTok...</p>;

  const directo = opciones.modo === "DIRECTO";

  return (
    <div className="rounded-lg border border-gray-200 p-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {creador.avatar && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creador.avatar} alt="" className="w-9 h-9 rounded-full" />
        )}
        <p className="text-sm">
          Se publica en la cuenta de TikTok <b>{creador.nombre}</b>
          {creador.usuario && <span className="text-gray-500"> (@{creador.usuario})</span>}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={directo} onChange={() => set({ modo: "DIRECTO" })} />
          Publicar directo en el perfil
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={!directo} onChange={() => set({ modo: "BORRADOR" })} />
          Mandar como borrador a la app de TikTok (lo terminás de editar y publicás desde el celular)
        </label>
      </div>

      {directo && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="tiktok-privacidad">
              ¿Quién puede ver {esVideo ? "este video" : "estas fotos"}?
            </label>
            <select
              id="tiktok-privacidad"
              value={opciones.privacidad || ""}
              onChange={(e) => set({ privacidad: (e.target.value || undefined) as Privacidad })}
              className="w-full sm:w-64 rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">Elegí una opción</option>
              {creador.privacidades.map((p) => (
                <option
                  key={p}
                  value={p}
                  disabled={p === "SELF_ONLY" && opciones.contenidoPatrocinado}
                >
                  {NOMBRE_PRIVACIDAD[p] || p}
                  {p === "SELF_ONLY" && opciones.contenidoPatrocinado
                    ? " (no disponible para contenido patrocinado)"
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Permitir que otros usuarios:</p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={creador.comentariosDesactivados}
                  checked={opciones.permitirComentarios && !creador.comentariosDesactivados}
                  onChange={(e) => set({ permitirComentarios: e.target.checked })}
                />
                Comenten
              </label>
              {esVideo && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={creador.duoDesactivado}
                  checked={opciones.permitirDuo && !creador.duoDesactivado}
                  onChange={(e) => set({ permitirDuo: e.target.checked })}
                />
                Hagan Dúo
              </label>
              )}
              {esVideo && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={creador.stitchDesactivado}
                  checked={opciones.permitirStitch && !creador.stitchDesactivado}
                  onChange={(e) => set({ permitirStitch: e.target.checked })}
                />
                Hagan Stitch
              </label>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={opciones.contenidoComercial}
                onChange={(e) =>
                  set({
                    contenidoComercial: e.target.checked,
                    marcaPropia: false,
                    contenidoPatrocinado: false,
                  })
                }
              />
              {esVideo ? "Este video" : "Esta publicación"} promociona una marca, un producto o un servicio
            </label>
            {opciones.contenidoComercial && (
              <div className="pl-6 flex flex-col gap-1">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={opciones.marcaPropia}
                    onChange={(e) => set({ marcaPropia: e.target.checked })}
                  />
                  Mi marca: promociono mi propio negocio
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={opciones.contenidoPatrocinado}
                    onChange={(e) =>
                      set({
                        contenidoPatrocinado: e.target.checked,
                        privacidad:
                          e.target.checked && opciones.privacidad === "SELF_ONLY"
                            ? undefined
                            : opciones.privacidad,
                      })
                    }
                  />
                  Contenido patrocinado: promociono a otra marca
                </label>
                {(opciones.marcaPropia || opciones.contenidoPatrocinado) && (
                  <p className="text-xs text-gray-500">
                    TikTok va a mostrar la publicación con la etiqueta{" "}
                    <b>
                      {opciones.contenidoPatrocinado ? "\"Colaboración pagada\"" : "\"Contenido promocional\""}
                    </b>
                    .
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <p className="text-xs text-gray-500">
        Al publicar, aceptás la{" "}
        {opciones.contenidoPatrocinado && (
          <>
            <a
              href="https://www.tiktok.com/legal/page/global/bc-policy/en"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Política de contenido de marca
            </a>{" "}
            y la{" "}
          </>
        )}
        <a
          href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Confirmación de uso de música
        </a>{" "}
        de TikTok. Después de publicar, TikTok puede tardar unos minutos en procesarla.{!esVideo && " A las fotos TikTok les agrega música automáticamente."}
      </p>
    </div>
  );
}
