"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Media } from "./media-manager";

type Formato = "FOTO" | "CARRUSEL" | "VIDEO";
type Red = "INSTAGRAM" | "FACEBOOK";

type Publicacion = {
  id: string;
  red: Red | "YOUTUBE" | "TIKTOK";
  formato: Formato;
  estado: "PROCESANDO" | "PUBLICADA" | "ERROR";
  permalink: string | null;
  error: string | null;
  texto: string;
  createdAt: string;
};

const MAX_CARRUSEL = 10;
const MAX_TEXTO = 2200;

const NOMBRE_RED: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
};
const NOMBRE_FORMATO: Record<Formato, string> = {
  FOTO: "Foto",
  CARRUSEL: "Carrusel",
  VIDEO: "Video / Reel",
};

export default function Publicador({
  productoId,
  media,
  redes,
  iaActiva,
}: {
  productoId: string;
  media: Media[];
  redes: { instagram: string | null; facebook: string | null };
  iaActiva: boolean;
}) {
  const fotos = useMemo(() => media.filter((m) => m.tipo === "FOTO"), [media]);
  const videos = useMemo(() => media.filter((m) => m.tipo === "VIDEO"), [media]);

  const [formato, setFormato] = useState<Formato>("FOTO");
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [destinos, setDestinos] = useState<Red[]>(() => {
    const d: Red[] = [];
    if (redes.instagram) d.push("INSTAGRAM");
    if (redes.facebook) d.push("FACEBOOK");
    return d;
  });
  const [texto, setTexto] = useState("");
  const [incluirPrecio, setIncluirPrecio] = useState(true);
  const [indicaciones, setIndicaciones] = useState("");
  const [generando, setGenerando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState("");
  const [historial, setHistorial] = useState<Publicacion[]>([]);

  // Selección por defecto cada vez que cambia el formato o los archivos.
  useEffect(() => {
    if (formato === "FOTO") setSeleccion(fotos[0] ? [fotos[0].id] : []);
    if (formato === "CARRUSEL") setSeleccion(fotos.slice(0, MAX_CARRUSEL).map((f) => f.id));
    if (formato === "VIDEO") setSeleccion(videos[0] ? [videos[0].id] : []);
  }, [formato, fotos, videos]);

  const cargarHistorial = useCallback(async () => {
    const r = await fetch(`/api/publicaciones?productoId=${productoId}`, { cache: "no-store" });
    if (r.ok) setHistorial(await r.json());
  }, [productoId]);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  // Mientras Instagram procesa un archivo, consultamos cada 5 segundos.
  const hayProcesando = historial.some((p) => p.estado === "PROCESANDO");
  useEffect(() => {
    if (!hayProcesando) return;
    const t = setInterval(cargarHistorial, 5000);
    return () => clearInterval(t);
  }, [hayProcesando, cargarHistorial]);

  const hayRedes = Boolean(redes.instagram || redes.facebook);
  const opciones = formato === "VIDEO" ? videos : fotos;

  function alternar(id: string) {
    if (formato !== "CARRUSEL") {
      setSeleccion([id]);
      return;
    }
    setSeleccion((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_CARRUSEL
        ? prev
        : [...prev, id]
    );
  }

  function alternarRed(red: Red) {
    setDestinos((prev) => (prev.includes(red) ? prev.filter((r) => r !== red) : [...prev, red]));
  }

  async function generar() {
    setError("");
    setGenerando(true);
    const r = await fetch("/api/ia/texto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productoId,
        red: destinos.length === 1 ? destinos[0] : "AMBAS",
        formato,
        incluirPrecio,
        indicaciones,
      }),
    });
    const data = await r.json().catch(() => ({}));
    setGenerando(false);
    if (!r.ok) {
      setError(data.error || "No se pudo generar el texto.");
      return;
    }
    setTexto(data.texto);
  }

  const problema = (() => {
    if (destinos.length === 0) return "Elegí al menos una red.";
    if (formato === "FOTO" && seleccion.length !== 1) return "Elegí 1 foto.";
    if (formato === "CARRUSEL" && seleccion.length < 2) return "Elegí al menos 2 fotos para el carrusel.";
    if (formato === "VIDEO" && seleccion.length !== 1) return "Elegí 1 video.";
    if (!texto.trim()) return "Falta el texto de la publicación.";
    if (texto.length > MAX_TEXTO) return `El texto supera los ${MAX_TEXTO} caracteres.`;
    return null;
  })();

  async function publicar() {
    if (problema) return;
    const donde = destinos.map((d) => NOMBRE_RED[d]).join(" y ");
    if (!confirm(`¿Publicar ahora en ${donde}? La publicación queda visible para todos.`)) return;

    setError("");
    setPublicando(true);
    const r = await fetch("/api/publicaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productoId, redes: destinos, formato, mediaIds: seleccion, texto }),
    });
    const data = await r.json().catch(() => ({}));
    setPublicando(false);
    if (!r.ok) {
      setError(data.error || "No se pudo publicar.");
      return;
    }
    await cargarHistorial();
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-5">
      <p className="text-xs font-bold uppercase tracking-wide text-gold">Publicar en redes</p>

      {!hayRedes ? (
        <p className="text-sm text-gray-600">
          Todavía no conectaste ninguna red.{" "}
          <a href="/dashboard/redes" className="text-navy font-medium hover:underline">
            Conectá Instagram y Facebook
          </a>{" "}
          para publicar desde acá.
        </p>
      ) : media.length === 0 ? (
        <p className="text-sm text-gray-600">Subí al menos una foto o un video para poder publicar.</p>
      ) : (
        <>
          {/* Formato */}
          <div className="flex flex-wrap gap-2">
            {(["FOTO", "CARRUSEL", "VIDEO"] as Formato[]).map((f) => {
              const deshabilitado =
                (f === "FOTO" && fotos.length === 0) ||
                (f === "CARRUSEL" && fotos.length < 2) ||
                (f === "VIDEO" && videos.length === 0);
              return (
                <button
                  key={f}
                  type="button"
                  disabled={deshabilitado}
                  onClick={() => setFormato(f)}
                  className={`rounded-md px-3 py-1.5 text-sm border ${
                    formato === f
                      ? "bg-navy text-white border-navy"
                      : "bg-white text-gray-700 border-gray-300 hover:border-navy"
                  } disabled:opacity-40 disabled:hover:border-gray-300`}
                >
                  {NOMBRE_FORMATO[f]}
                </button>
              );
            })}
          </div>

          {/* Archivos */}
          <div>
            <p className="text-sm font-medium mb-2">
              {formato === "CARRUSEL"
                ? `Fotos del carrusel (${seleccion.length}/${MAX_CARRUSEL}) — tocá para elegir y ordenar`
                : formato === "VIDEO"
                ? "Video a publicar"
                : "Foto a publicar"}
            </p>
            <div className={`grid gap-2 ${formato === "VIDEO" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-5"}`}>
              {opciones.map((m) => {
                const pos = seleccion.indexOf(m.id);
                const elegido = pos >= 0;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => alternar(m.id)}
                    className={`relative rounded-lg overflow-hidden border-2 ${
                      elegido ? "border-navy" : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    {m.tipo === "FOTO" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt="" className="w-full aspect-square object-cover" />
                    ) : (
                      <video src={m.url} muted preload="metadata" className="w-full aspect-video object-cover bg-black" />
                    )}
                    {elegido && (
                      <span className="absolute top-1 left-1 min-w-5 h-5 px-1 rounded-full bg-navy text-white text-[11px] font-bold flex items-center justify-center">
                        {formato === "CARRUSEL" ? pos + 1 : "✓"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {formato === "VIDEO"
                ? "En Instagram se publica como Reel: ideal vertical 9:16, de 3 segundos a 15 minutos."
                : "Instagram acepta fotos entre horizontal 1.91:1 y vertical 4:5. En el carrusel, todas se recortan como la primera."}
            </p>
          </div>

          {/* Redes */}
          <div className="flex flex-wrap gap-4">
            {redes.instagram && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={destinos.includes("INSTAGRAM")}
                  onChange={() => alternarRed("INSTAGRAM")}
                />
                Instagram <span className="text-gray-400">{redes.instagram}</span>
              </label>
            )}
            {redes.facebook && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={destinos.includes("FACEBOOK")}
                  onChange={() => alternarRed("FACEBOOK")}
                />
                Facebook <span className="text-gray-400">{redes.facebook}</span>
              </label>
            )}
          </div>

          {/* Texto */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Texto de la publicación</p>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={incluirPrecio}
                  onChange={(e) => setIncluirPrecio(e.target.checked)}
                />
                Mostrar precio
              </label>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={indicaciones}
                onChange={(e) => setIndicaciones(e.target.value)}
                placeholder="Indicaciones para la IA (opcional): ej. enfocalo en revendedores"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy"
              />
              <button
                type="button"
                onClick={generar}
                disabled={!iaActiva || generando}
                title={iaActiva ? "" : "Falta configurar la IA en Redes sociales"}
                className="shrink-0 rounded-md border border-navy text-navy text-sm font-semibold px-4 py-2 hover:bg-navy/5 disabled:opacity-50"
              >
                {generando ? "Escribiendo..." : texto ? "✨ Generar otro" : "✨ Generar con IA"}
              </button>
            </div>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={9}
              placeholder="Escribí el texto o generalo con IA y ajustalo a tu gusto."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy"
            />
            <p className={`text-xs text-right ${texto.length > MAX_TEXTO ? "text-red-600" : "text-gray-400"}`}>
              {texto.length}/{MAX_TEXTO}
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={publicar}
              disabled={Boolean(problema) || publicando}
              className="rounded-md bg-navy text-white text-sm font-semibold px-5 py-2.5 hover:opacity-90 disabled:opacity-50"
            >
              {publicando ? "Publicando..." : "Publicar ahora"}
            </button>
            {problema && <span className="text-xs text-gray-500">{problema}</span>}
          </div>
        </>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm font-medium mb-2">Publicaciones de este producto</p>
          <ul className="flex flex-col gap-2">
            {historial.map((p) => (
              <li key={p.id} className="text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium">{NOMBRE_RED[p.red]}</span>
                <span className="text-gray-500">{NOMBRE_FORMATO[p.formato]}</span>
                <span className="text-gray-400 text-xs">
                  {new Date(p.createdAt).toLocaleString("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                {p.estado === "PUBLICADA" && (
                  <span className="text-green-700 text-xs font-semibold">
                    Publicada
                    {p.permalink && (
                      <>
                        {" · "}
                        <a href={p.permalink} target="_blank" rel="noreferrer" className="underline">
                          ver
                        </a>
                      </>
                    )}
                  </span>
                )}
                {p.estado === "PROCESANDO" && (
                  <span className="text-amber-600 text-xs font-semibold">Procesando...</span>
                )}
                {p.estado === "ERROR" && (
                  <span className="text-red-600 text-xs">No se publicó: {p.error}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
