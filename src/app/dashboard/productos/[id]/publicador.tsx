"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Media } from "./media-manager";
import TikTokOpciones, {
  OPCIONES_TIKTOK_INICIALES,
  problemaTikTok,
  type Creador,
  type OpcionesTikTok,
} from "./tiktok-opciones";

type Formato = "FOTO" | "CARRUSEL" | "VIDEO";
type Red = "INSTAGRAM" | "FACEBOOK" | "TIKTOK";

type Publicacion = {
  id: string;
  red: Red | "YOUTUBE";
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
  preseleccion,
}: {
  productoId: string;
  media: Media[];
  redes: { instagram: string | null; facebook: string | null; tiktok: string | null };
  iaActiva: boolean;
  // Archivos elegidos desde el Estudio IA para publicar.
  preseleccion?: { ids: string[]; tipo: "FOTO" | "VIDEO"; clave: number } | null;
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
  const [opcionesTikTok, setOpcionesTikTok] = useState<OpcionesTikTok>(OPCIONES_TIKTOK_INICIALES);
  const [creadorTikTok, setCreadorTikTok] = useState<Creador | null>(null);
  const [duracionVideo, setDuracionVideo] = useState<number | null>(null);

  const caja = useRef<HTMLDivElement>(null);
  const pendiente = useRef<string[] | null>(null);

  // Selección por defecto cada vez que cambia el formato o los archivos
  // (salvo que venga algo elegido desde el Estudio IA).
  useEffect(() => {
    const disponibles = formato === "VIDEO" ? videos : fotos;
    if (pendiente.current && pendiente.current.every((id) => disponibles.some((m) => m.id === id))) {
      setSeleccion(pendiente.current);
      pendiente.current = null;
      return;
    }
    if (formato === "FOTO") setSeleccion(fotos[0] ? [fotos[0].id] : []);
    if (formato === "CARRUSEL") setSeleccion(fotos.slice(0, MAX_CARRUSEL).map((f) => f.id));
    if (formato === "VIDEO") setSeleccion(videos[0] ? [videos[0].id] : []);
  }, [formato, fotos, videos]);

  // Llegó algo del Estudio IA: lo dejamos elegido y bajamos hasta acá.
  useEffect(() => {
    if (!preseleccion) return;
    const nuevo: Formato =
      preseleccion.tipo === "VIDEO" ? "VIDEO" : preseleccion.ids.length > 1 ? "CARRUSEL" : "FOTO";
    const disponibles = nuevo === "VIDEO" ? videos : fotos;
    if (nuevo === formato && preseleccion.ids.every((id) => disponibles.some((m) => m.id === id))) {
      setSeleccion(preseleccion.ids);
    } else {
      pendiente.current = preseleccion.ids;
      setFormato(nuevo);
    }
    caja.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preseleccion?.clave]);

  // Duración del video elegido, para avisar si TikTok no lo acepta.
  const videoElegido = formato === "VIDEO" ? videos.find((v) => v.id === seleccion[0]) : undefined;
  useEffect(() => {
    setDuracionVideo(null);
    if (!videoElegido) return;
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => setDuracionVideo(Number.isFinite(v.duration) ? v.duration : null);
    v.src = videoElegido.url;
  }, [videoElegido]);

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

  const elegidos = seleccion
    .map((id) => media.find((m) => m.id === id))
    .filter((m): m is Media => Boolean(m));
  const [vistaIdx, setVistaIdx] = useState(0);
  useEffect(() => setVistaIdx(0), [seleccion]);

  const hayRedes = Boolean(redes.instagram || redes.facebook || redes.tiktok);
  const conTikTok = destinos.includes("TIKTOK");
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
    if (conTikTok) return problemaTikTok(opcionesTikTok, creadorTikTok, duracionVideo);
    return null;
  })();

  async function publicar() {
    if (problema) return;
    const donde = destinos.map((d) => NOMBRE_RED[d]).join(" y ");
    if (!confirm(`¿Publicar ahora en ${donde}?`)) return;

    setError("");
    setPublicando(true);
    const r = await fetch("/api/publicaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productoId,
        redes: destinos,
        formato,
        mediaIds: seleccion,
        texto,
        tiktok: conTikTok ? opcionesTikTok : undefined,
      }),
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
    <div ref={caja} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-5 scroll-mt-4">
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
          <div>
            <p className="text-sm font-medium mb-2">¿En qué redes lo subís?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  ["INSTAGRAM", redes.instagram],
                  ["FACEBOOK", redes.facebook],
                  ["TIKTOK", redes.tiktok],
                ] as [Red, string | null][]
              ).map(([red, cuenta]) => {
                const activa = destinos.includes(red);
                return (
                  <button
                    key={red}
                    type="button"
                    disabled={!cuenta}
                    onClick={() => alternarRed(red)}
                    className={`text-left rounded-lg border-2 px-3 py-2 transition ${
                      activa ? "border-navy bg-navy/5" : "border-gray-200 hover:border-gray-400"
                    } disabled:opacity-50 disabled:hover:border-gray-200`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900">{NOMBRE_RED[red]}</span>
                      <span
                        className={`w-5 h-5 rounded border flex items-center justify-center text-xs ${
                          activa ? "bg-navy border-navy text-white" : "border-gray-300"
                        }`}
                      >
                        {activa ? "✓" : ""}
                      </span>
                    </span>
                    <span className="block text-xs text-gray-500 truncate">
                      {cuenta || "Sin conectar"}
                    </span>
                  </button>
                );
              })}
            </div>
            {!redes.tiktok || !redes.instagram || !redes.facebook ? (
              <p className="text-xs text-gray-400 mt-1.5">
                Las redes sin conectar se conectan en{" "}
                <a href="/dashboard/redes" className="underline">
                  Redes sociales
                </a>
                .
              </p>
            ) : null}
          </div>

          {conTikTok && (
            <TikTokOpciones
              esVideo={formato === "VIDEO"}
              opciones={opcionesTikTok}
              onCambio={setOpcionesTikTok}
              creador={creadorTikTok}
              onCreador={setCreadorTikTok}
            />
          )}

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

          {/* Vista previa */}
          {elegidos.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-700">
                Vista previa{destinos.length > 0 ? ` · ${destinos.map((d) => NOMBRE_RED[d]).join(", ")}` : ""}
              </p>
              <div className="bg-white rounded-md border border-gray-200 overflow-hidden max-w-sm w-full mx-auto">
                {elegidos[vistaIdx]?.tipo === "VIDEO" ? (
                  <video
                    src={elegidos[vistaIdx].url}
                    controls
                    playsInline
                    className="w-full max-h-[28rem] bg-black"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={elegidos[vistaIdx]?.url}
                    alt=""
                    className="w-full max-h-[28rem] object-contain bg-gray-100"
                  />
                )}
                {elegidos.length > 1 && (
                  <div className="flex justify-center gap-1.5 py-2">
                    {elegidos.map((m, i) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setVistaIdx(i)}
                        aria-label={`Ver ${i + 1}`}
                        className={`w-2 h-2 rounded-full ${i === vistaIdx ? "bg-navy" : "bg-gray-300"}`}
                      />
                    ))}
                  </div>
                )}
                <p className="px-3 py-2 text-xs text-gray-700 whitespace-pre-line line-clamp-6">
                  {texto || <span className="text-gray-400">Acá va a aparecer el texto.</span>}
                </p>
              </div>
            </div>
          )}

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
