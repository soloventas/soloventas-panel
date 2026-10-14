"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Media } from "./media-manager";
import {
  ESCENAS,
  ESTILOS,
  MAX_ESTILOS,
  type EstiloId,
  FOTO_TIPOS,
  FORMATOS,
  PERSONAS,
  VIDEO_TIPOS,
  ACCIONES_UGC,
  type AccionUgcId,
  promptVideo,
  promptsFotos,
  type EscenaId,
  type FotoTipoId,
  type FormatoId,
  type PersonaId,
  type TextoPosId,
  type VideoTipoId,
} from "@/lib/estudio";
import VistaPreviaIA from "./vista-previa-ia";
import { upload } from "@vercel/blob/client";
import { MODELOS_GRATIS } from "@/lib/cloudflare-ia";
import { achicarFoto, armarVideo, type VideoArmado } from "@/lib/video-navegador";
import {
  buscarModelo,
  costoTexto,
  MODELOS_AUTO,
  herramientasPara,
  modelosPara,
} from "@/lib/proveedores-ia";

type Modo = "FOTO" | "VIDEO";

type Trabajo = {
  id: string;
  tipo: Modo;
  estado: "PENDIENTE" | "LISTO" | "ERROR";
  error: string | null;
  createdAt: string;
  modelo?: string;
  media: { id: string; url: string; tipo: Modo; aprobado: boolean } | null;
};

// Nombre amigable de la IA que hizo cada resultado.
function nombreDeIA(modelo?: string) {
  if (!modelo) return "IA";
  if (modelo === "video-gratis-navegador") return "Video con tus fotos";
  return (
    MODELOS_GRATIS.find((m) => m.modelo === modelo)?.nombre ||
    MODELOS_AUTO.find((m) => m.endpoint === modelo)?.nombre ||
    "IA"
  );
}

// Qué se puede hacer: cada tarea define si es foto o video y qué variante.
type Tarea = {
  id: string;
  modo: Modo;
  fotoTipo?: FotoTipoId;
  videoTipo?: VideoTipoId;
  icono: string;
  nombre: string;
  ayuda: string;
  recomendada?: boolean;
  // Video gratis armado en el panel con tus fotos (sin IA de video).
  panelVideo?: boolean;
};

const ICONOS_FOTO: Record<FotoTipoId, string> = {
  pack: "👩‍🦰",
  escena: "🏝️",
  catalogo: "⬜",
  mejorar: "✨",
};
const ICONOS_VIDEO: Record<VideoTipoId, string> = {
  ugc: "🤳",
  giro: "🔄",
  persona: "🎬",
  colores: "🎨",
};

const TAREAS: Tarea[] = [
  ...FOTO_TIPOS.map((f) => ({
    id: `foto-${f.id}`,
    modo: "FOTO" as Modo,
    fotoTipo: f.id,
    icono: ICONOS_FOTO[f.id],
    nombre: f.nombre,
    ayuda: f.ayuda,
    recomendada: f.id === "pack",
  })),
  {
    id: "video-fotos",
    modo: "VIDEO" as Modo,
    videoTipo: "giro" as VideoTipoId,
    icono: "🎞️",
    nombre: "Video con tus fotos",
    ayuda: "Gratis: arma un video vertical con tus fotos reales, con movimiento suave, transiciones y tu texto.",
    panelVideo: true,
  },
  // Videos con IA de video: necesitan una IA paga conectada (opcional).
  ...VIDEO_TIPOS.map((v) => ({
    id: `video-${v.id}`,
    modo: "VIDEO" as Modo,
    videoTipo: v.id,
    icono: ICONOS_VIDEO[v.id],
    nombre: `Video: ${v.nombre} · paga`,
    ayuda: v.ayuda,
  })),
];

// La IA elegida: gratis dentro del panel, una web gratis o un modelo pago.
type EleccionIA = { clase: "panel" | "gratis" | "paga"; id: string };

// Video gratis hecho en el navegador con las fotos reales del producto.
const VIDEO_PANEL = {
  id: "video-fotos",
  nombre: "Video con tus fotos",
  empresa: "Hecho en tu panel",
  detalle: "Gratis y sin límite. Movimiento suave, transiciones y tu texto, con las fotos reales.",
};

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs border transition ${
        activo
          ? "bg-navy text-white border-navy"
          : "bg-white text-gray-700 border-gray-300 hover:border-navy"
      }`}
    >
      {children}
    </button>
  );
}

function Paso({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <p className="text-sm font-semibold text-navy flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-navy text-white text-xs flex items-center justify-center">
          {numero}
        </span>
        {titulo}
      </p>
      {children}
    </section>
  );
}

function TarjetaIA({
  activa,
  onClick,
  nombre,
  empresa,
  detalle,
  etiqueta,
  recomendada,
  apagada,
}: {
  activa: boolean;
  onClick: () => void;
  nombre: string;
  empresa: string;
  detalle: string;
  etiqueta: string;
  recomendada?: boolean;
  apagada?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border-2 p-2.5 transition flex flex-col gap-0.5 ${
        activa ? "border-navy bg-navy/5" : "border-gray-200 hover:border-gray-400 bg-white"
      } ${apagada && !activa ? "opacity-60" : ""}`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">
          {recomendada && "⭐ "}
          {nombre}
        </span>
        <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-gray-100 text-gray-700 whitespace-nowrap">
          {etiqueta}
        </span>
      </span>
      <span className="text-[11px] text-gray-500">{empresa}</span>
      <span className="text-[11px] text-gray-600 leading-snug">{detalle}</span>
    </button>
  );
}

export default function EstudioIA({
  productoId,
  producto,
  fotos,
  falActivo,
  cfActivo = false,
  onNuevos,
  onPublicar,
}: {
  productoId: string;
  producto: string;
  fotos: Media[];
  falActivo: boolean;
  cfActivo?: boolean;
  onNuevos: () => void | Promise<void>;
  // Lleva lo elegido al publicador (ya aprobado) para elegir redes y publicar.
  onPublicar?: (ids: string[], tipo: Modo) => void;
}) {
  const [tareaId, setTareaId] = useState(TAREAS[0].id);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [escena, setEscena] = useState<EscenaId>("playa");
  const [escenaPersonalizada, setEscenaPersonalizada] = useState("");
  const [persona, setPersona] = useState<PersonaId>("mujer");
  const [formato, setFormato] = useState<FormatoId>("4:5");
  const [duracion, setDuracion] = useState<5 | 10>(5);
  // Por defecto, siempre una gratis: primero la que funciona dentro del panel.
  const [ia, setIa] = useState<Record<Modo, EleccionIA>>(() => ({
    FOTO: { clase: "panel", id: MODELOS_GRATIS[0].id },
    VIDEO: { clase: "panel", id: VIDEO_PANEL.id },
  }));
  const [progreso, setProgreso] = useState<number | null>(null);
  // Videos armados que todavía no se guardaron: se juntan para comparar.
  const [borradores, setBorradores] = useState<(VideoArmado & { url: string; clave: number })[]>([]);
  // Resultados elegidos para publicar juntos (se pueden mezclar de distintas IA).
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [verTodas, setVerTodas] = useState(false);
  const [extra, setExtra] = useState("");
  // Anuncio UGC: qué hace la persona y la descripción del vendedor.
  const [accion, setAccion] = useState<AccionUgcId>("auto");
  const [detalle, setDetalle] = useState("");
  const [texto, setTexto] = useState("");
  const [textoPos, setTextoPos] = useState<TextoPosId>("arriba");
  // Estilos de publicidad marcados: sale una edición por cada uno.
  const [estilos, setEstilos] = useState<EstiloId[]>(["publicidad"]);
  const [copiado, setCopiado] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const listosAntes = useRef<Set<string>>(new Set());
  const inicializado = useRef(false);

  // Los videos con IA (pagos) aparecen solo si conectaste una IA paga.
  const tareas = TAREAS.filter((t) => t.modo === "FOTO" || t.panelVideo || falActivo);
  const tarea = tareas.find((t) => t.id === tareaId) || tareas[0];
  const modo = tarea.modo;
  const fotoTipo: FotoTipoId = tarea.fotoTipo || "pack";
  const videoTipo: VideoTipoId = tarea.videoTipo || "giro";
  const herramientaFoto = FOTO_TIPOS.find((f) => f.id === fotoTipo)!;
  const usaEscena = modo === "VIDEO" ? !tarea.panelVideo : herramientaFoto.usaEscena;
  const usaPersona = modo === "FOTO" ? herramientaFoto.usaPersona : videoTipo === "persona" || videoTipo === "ugc";
  // El video con tus fotos no puede crear una persona: el UGC va con una IA de video.
  const esUgc = modo === "VIDEO" && videoTipo === "ugc";
  const maxSeleccion = 4;

  // Por defecto usamos la primera foto como base.
  useEffect(() => {
    setSeleccion((prev) => {
      const validas = prev.filter((id) => fotos.some((f) => f.id === id)).slice(0, maxSeleccion);
      if (validas.length > 0) return validas;
      return fotos[0] ? [fotos[0].id] : [];
    });
  }, [fotos, maxSeleccion]);

  const prompts = useMemo(() => {
    if (modo === "FOTO") {
      return promptsFotos(fotoTipo, {
        producto,
        escena,
        escenaPersonalizada,
        persona,
        formato,
        extra,
        texto,
        textoPos,
        estilos,
      });
    }
    return [
      {
        titulo: "Video",
        prompt: promptVideo({
          producto,
          tipo: videoTipo,
          escena,
          escenaPersonalizada,
          persona,
          extra,
          texto,
          textoPos,
          accion,
          detalle,
        }),
      },
    ];
  }, [modo, fotoTipo, producto, escena, escenaPersonalizada, persona, formato, videoTipo, extra, texto, textoPos, estilos, accion, detalle]);

  const herramientas = herramientasPara(modo);
  const modelos = modelosPara(modo);
  const eleccion = ia[modo];
  const herramienta = herramientas.find((h) => h.id === eleccion.id) || herramientas[0];
  // Para no llenar la pantalla: se ven las primeras y la elegida; el resto con "Ver todas".
  const VISIBLES = 4;
  const herramientasVisibles = verTodas
    ? herramientas
    : herramientas.filter((h, i) => i < VISIBLES || (eleccion.clase === "gratis" && h.id === herramienta.id));
  const modelo = buscarModelo(modo, eleccion.clase === "paga" ? eleccion.id : undefined);
  const modeloGratis = MODELOS_GRATIS.find((m) => m.id === eleccion.id) || MODELOS_GRATIS[0];
  const nombrePanel = modo === "VIDEO" ? VIDEO_PANEL.nombre : modeloGratis.nombre;
  const cantidadFotos = modo === "FOTO" ? prompts.length : 0;
  const costo = costoTexto(modelo, modo, duracion, cantidadFotos);

  const seleccionadas = seleccion
    .map((id) => fotos.find((f) => f.id === id))
    .filter((f): f is Media => Boolean(f));

  // El video con tus fotos se hace en el panel; los otros videos, con la IA paga.
  const panelVideo = Boolean(tarea.panelVideo);
  useEffect(() => {
    if (modo !== "VIDEO") return;
    if (panelVideo && ia.VIDEO.clase !== "panel") {
      setIa((prev) => ({ ...prev, VIDEO: { clase: "panel", id: VIDEO_PANEL.id } }));
    } else if (!panelVideo && ia.VIDEO.clase !== "paga") {
      setIa((prev) => ({ ...prev, VIDEO: { clase: "paga", id: modelosPara("VIDEO")[0].id } }));
    }
  }, [modo, panelVideo, ia.VIDEO.clase]);

  function elegirIA(e: EleccionIA) {
    setIa((prev) => ({ ...prev, [modo]: e }));
  }

  const cargarTrabajos = useCallback(async () => {
    const r = await fetch(`/api/ia/estudio?productoId=${productoId}`, { cache: "no-store" });
    if (!r.ok) return;
    const data: Trabajo[] = await r.json();
    setTrabajos(data);
    // Si algo terminó desde la última consulta, recargamos las fotos/videos.
    const listos = data.filter((t) => t.estado === "LISTO").map((t) => t.id);
    const nuevos = listos.some((id) => !listosAntes.current.has(id));
    listos.forEach((id) => listosAntes.current.add(id));
    if (nuevos && inicializado.current) onNuevos();
    inicializado.current = true;
  }, [productoId, onNuevos]);

  useEffect(() => {
    cargarTrabajos();
  }, [cargarTrabajos]);

  const hayPendientes = trabajos.some((t) => t.estado === "PENDIENTE");
  useEffect(() => {
    if (!hayPendientes) return;
    const t = setInterval(cargarTrabajos, 6000);
    return () => clearInterval(t);
  }, [hayPendientes, cargarTrabajos]);

  function alternar(id: string) {
    setSeleccion((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= maxSeleccion
        ? [...prev.slice(1), id]
        : [...prev, id]
    );
  }

  async function copiar(i: number) {
    try {
      await navigator.clipboard.writeText(prompts[i].prompt);
      setCopiado(i);
      setTimeout(() => setCopiado(null), 2500);
    } catch {
      setError("No se pudo copiar. Seleccioná el texto y copialo a mano.");
    }
  }

  const problema = (() => {
    if (seleccion.length === 0) return "Elegí al menos una foto de base.";
    if (modo === "VIDEO" && videoTipo === "colores" && seleccion.length < 2)
      return "Para el cambio de color elegí 2 fotos en distintos colores.";
    if (usaEscena && escena === "personalizada" && !escenaPersonalizada.trim())
      return "Describí el lugar que querés.";
    return null;
  })();

  async function generar() {
    if (problema) return;
    const que =
      modo === "FOTO"
        ? cantidadFotos > 1
          ? `${cantidadFotos} fotos (${prompts.map((p) => p.titulo.toLowerCase()).join(", ")})`
          : `1 foto (${herramientaFoto.nombre.toLowerCase()})`
        : `un video de ${duracion} segundos`;
    if (!confirm(`¿Generar ${que} con ${modelo.nombre}? Costo: ${costo}.`)) return;
    setError("");
    setEnviando(true);
    const r = await fetch("/api/ia/estudio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productoId,
        tipo: modo,
        mediaIds: seleccion,
        modeloId: modelo.id,
        fotoTipo,
        escena,
        escenaPersonalizada,
        persona,
        formato,
        videoTipo,
        duracion,
        extra,
        accion,
        detalle,
        texto,
        textoPos,
        estilos,
      }),
    });
    const data = await r.json().catch(() => ({}));
    setEnviando(false);
    if (!r.ok) {
      setError(data.error || "No se pudo enviar a la IA.");
      return;
    }
    await cargarTrabajos();
  }

  // Fotos con la IA gratis del panel (FLUX.2 Klein en Cloudflare).
  async function generarGratis() {
    if (problema) return;
    setError("");
    setEnviando(true);
    try {
      const form = new FormData();
      form.append(
        "datos",
        JSON.stringify({
          productoId,
          modeloId: modeloGratis.id,
          fotoTipo,
          escena,
          escenaPersonalizada,
          persona,
          formato,
          extra,
          texto,
          textoPos,
          estilos,
        })
      );
      const refs = await Promise.all(seleccionadas.map((f) => achicarFoto(f.url)));
      refs.forEach((b, i) => form.append(`ref_${i}`, b, `ref${i}.jpg`));
      const r = await fetch("/api/ia/gratis", { method: "POST", body: form });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "La IA gratis no pudo generar la foto.");
      if (data.aviso) setError(data.aviso);
      await cargarTrabajos();
      await onNuevos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "La IA gratis no pudo generar la foto.");
    }
    setEnviando(false);
  }

  // Video gratis: se arma en el navegador y se muestra antes de guardarlo.
  async function armarVideoGratis() {
    if (problema) return;
    setError("");
    setProgreso(0);
    try {
      const v = await armarVideo({
        urls: seleccionadas.map((f) => f.url),
        segundos: Math.max(duracion, seleccionadas.length * 3),
        texto,
        textoPos,
        onProgreso: setProgreso,
      });
      setBorradores((prev) => [{ ...v, url: URL.createObjectURL(v.blob), clave: Date.now() }, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo armar el video.");
    }
    setProgreso(null);
  }

  function quitarBorrador(clave: number) {
    setBorradores((prev) => {
      const b = prev.find((x) => x.clave === clave);
      if (b) URL.revokeObjectURL(b.url);
      return prev.filter((x) => x.clave !== clave);
    });
  }

  async function guardarVideo(videoListo: (typeof borradores)[number]) {
    setError("");
    setEnviando(true);
    try {
      const nombre = `video-${Date.now()}.${videoListo.extension}`;
      const blob = await upload(`productos/${productoId}/videos/${nombre}`, videoListo.blob, {
        access: "public",
        handleUploadUrl: "/api/media/upload",
        clientPayload: JSON.stringify({ productoId, tipo: "VIDEO" }),
        contentType: videoListo.tipo,
      });
      const r = await fetch(`/api/productos/${productoId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: blob.url,
          pathname: blob.pathname,
          tipo: "VIDEO",
          nombre,
          tamano: videoListo.blob.size,
          origen: "ORIGINAL",
        }),
      });
      const media = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(media.error || "No se pudo guardar el video.");
      await fetch("/api/ia/gratis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "registrar", productoId, mediaId: media.id }),
      });
      quitarBorrador(videoListo.clave);
      await cargarTrabajos();
      await onNuevos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el video.");
    }
    setEnviando(false);
  }

  const [ocupado, setOcupado] = useState<string | null>(null);

  // Aprueba lo que hizo la IA y lo lleva a "Publicar en redes".
  async function usarResultados(lista: NonNullable<Trabajo["media"]>[]) {
    setError("");
    setOcupado(lista[0].id);
    for (const m of lista) {
      if (m.aprobado) continue;
      const r = await fetch(`/api/productos/${productoId}/media/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "aprobar" }),
      });
      if (!r.ok) {
        setOcupado(null);
        setError("No se pudo aprobar. Probá de nuevo.");
        return;
      }
    }
    await cargarTrabajos();
    await onNuevos();
    setOcupado(null);
    onPublicar?.(
      lista.map((m) => m.id),
      lista[0].tipo
    );
  }

  function alternarElegida(id: string) {
    setElegidas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function actualizar() {
    setOcupado("actualizar");
    await cargarTrabajos();
    await onNuevos();
    setOcupado(null);
  }

  // "Más como esta": 2 versiones nuevas con el mismo estilo que un resultado.
  async function masComoEsta(t: Trabajo) {
    if (!t.media) return;
    setError("");
    setOcupado(`variar-${t.id}`);
    try {
      const form = new FormData();
      form.append(
        "datos",
        JSON.stringify({ productoId, modeloId: modeloGratis.id, variarDe: t.id, formato })
      );
      const urls = [t.media.url, ...seleccionadas.map((f) => f.url)].slice(0, 4);
      const refs = await Promise.all(urls.map((u) => achicarFoto(u)));
      refs.forEach((b, i) => form.append(`ref_${i}`, b, `ref${i}.jpg`));
      const r = await fetch("/api/ia/gratis", { method: "POST", body: form });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "La IA gratis no pudo generar más opciones.");
      if (data.aviso) setError(data.aviso);
      await cargarTrabajos();
      await onNuevos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "La IA gratis no pudo generar más opciones.");
    }
    setOcupado(null);
  }

  async function descartar(m: NonNullable<Trabajo["media"]>) {
    if (!confirm("¿Descartar este resultado? Se borra del producto.")) return;
    setOcupado(m.id);
    await fetch(`/api/productos/${productoId}/media/${m.id}`, { method: "DELETE" });
    setElegidas((prev) => prev.filter((x) => x !== m.id));
    await cargarTrabajos();
    onNuevos();
    setOcupado(null);
  }

  // Todas las versiones listas, de la más nueva a la más vieja. No se borra
  // ninguna hasta que el usuario la descarte.
  const resultados = trabajos.filter((t) => t.estado === "LISTO" && t.media);
  const mediasElegidas = elegidas
    .map((id) => resultados.find((t) => t.media?.id === id)?.media)
    .filter((m): m is NonNullable<Trabajo["media"]> => Boolean(m));
  const mezclaTipos = new Set(mediasElegidas.map((m) => m.tipo)).size > 1;
  const variosVideos = mediasElegidas.filter((m) => m.tipo === "VIDEO").length > 1;
  const otrosTrabajos = trabajos.filter((t) => !(t.estado === "LISTO" && t.media));

  if (fotos.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-gold mb-2">Estudio IA</p>
        <p className="text-sm text-gray-600">
          Subí al menos una foto real del producto (arriba, en Fotos y videos) para crear fotos y
          videos con IA.
        </p>
      </div>
    );
  }

  const pasos = herramienta.pasos[modo];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gold">Estudio IA</p>
        <p className="text-sm text-gray-600 mt-0.5">
          Elegí qué querés hacer, con qué fotos y con qué IA. Lo marcado con ⭐ es lo que mejor vende.
        </p>
      </div>

      {/* 1. Qué hacer */}
      <Paso numero={1} titulo="¿Qué querés hacer?">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {tareas.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTareaId(t.id)}
              className={`text-left rounded-lg border-2 p-2.5 transition ${
                tarea.id === t.id ? "border-navy bg-navy/5" : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <span className="text-lg leading-none">{t.icono}</span>
              <span className="block text-sm font-semibold text-gray-900 mt-1">
                {t.recomendada && "⭐ "}
                {t.nombre}
              </span>
              <span className="block text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">
                {t.modo === "FOTO" ? "Foto" : "Video"}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">{tarea.ayuda}</p>
      </Paso>

      {/* 2. Fotos de base */}
      <Paso
        numero={2}
        titulo={`${modo === "FOTO" ? "Foto(s) del producto" : "Foto(s) de base del video"} · hasta ${maxSeleccion}`}
      >
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {fotos.map((f) => {
            const pos = seleccion.indexOf(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => alternar(f.id)}
                className={`relative rounded-lg overflow-hidden border-2 ${
                  pos >= 0 ? "border-navy" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt="" className="w-full aspect-square object-cover" />
                {pos >= 0 && (
                  <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-navy text-white text-[11px] font-bold flex items-center justify-center">
                    {pos + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {modo === "VIDEO" && (
          <p className="text-xs text-gray-500">
            La foto 1 es el inicio del video. Con las IA de video se usan la primera y la última.
          </p>
        )}
      </Paso>

      {/* 3. Cómo lo querés */}
      <Paso numero={3} titulo="¿Cómo lo querés?">
        {usaEscena && (
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1.5">Lugar / ambiente</p>
            <div className="flex flex-wrap gap-2">
              {ESCENAS.map((e) => (
                <Chip key={e.id} activo={escena === e.id} onClick={() => setEscena(e.id)}>
                  {e.nombre}
                </Chip>
              ))}
            </div>
            {escena === "personalizada" && (
              <input
                value={escenaPersonalizada}
                onChange={(e) => setEscenaPersonalizada(e.target.value)}
                placeholder="Describilo (podés escribir en español): ej. un festival de música al aire libre"
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy"
              />
            )}
          </div>
        )}

        {usaPersona && (
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1.5">¿Quién aparece?</p>
            <div className="flex flex-wrap gap-2">
              {PERSONAS.filter((p) => p.id !== "ninguna").map((p) => (
                <Chip key={p.id} activo={persona === p.id} onClick={() => setPersona(p.id)}>
                  {p.nombre}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              Siempre son personas adultas creadas por IA, que no existen.
            </p>
          </div>
        )}

        {esUgc && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-700">¿Qué hace la persona con tu artículo?</p>
            <div className="flex flex-wrap gap-2">
              {ACCIONES_UGC.map((a) => (
                <Chip key={a.id} activo={accion === a.id} onClick={() => setAccion(a.id)}>
                  {a.nombre}
                </Chip>
              ))}
            </div>
            <textarea
              value={detalle}
              onChange={(e) => setDetalle(e.target.value.slice(0, 400))}
              rows={3}
              placeholder="Contale a la IA qué querés ver, en tus palabras. Ej.: una chica se arma una colita alta con la colita de pelo y sonríe a cámara · un chico juega con la pelota en la plaza · se pone la remera y muestra cómo le queda"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy"
            />
            <p className="text-xs text-gray-500">
              Para que salga mejor elegí como base una foto donde el artículo se vea claro.
            </p>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-gray-700 mb-1.5">
            {modo === "FOTO" ? "Formato" : "Duración"}
          </p>
          <div className="flex flex-wrap gap-2">
            {modo === "FOTO"
              ? FORMATOS.map((f) => (
                  <Chip key={f.id} activo={formato === f.id} onClick={() => setFormato(f.id)}>
                    {f.nombre}
                  </Chip>
                ))
              : [5, 10].map((d) => (
                  <Chip key={d} activo={duracion === d} onClick={() => setDuracion(d as 5 | 10)}>
                    {d} segundos
                  </Chip>
                ))}
          </div>
        </div>

        {modo === "FOTO" && (fotoTipo === "pack" || fotoTipo === "escena") && (
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1.5">
              Estilo de publicidad · marcá hasta {MAX_ESTILOS} y sale una foto por cada uno
            </p>
            <div className="flex flex-wrap gap-2">
              {ESTILOS.map((e) => {
                const activo = estilos.includes(e.id);
                return (
                  <Chip
                    key={e.id}
                    activo={activo}
                    onClick={() =>
                      setEstilos((prev) =>
                        activo
                          ? prev.length > 1
                            ? prev.filter((x) => x !== e.id)
                            : prev
                          : prev.length >= MAX_ESTILOS
                          ? [...prev.slice(1), e.id]
                          : [...prev, e.id]
                      )
                    }
                  >
                    {activo ? "✓ " : ""}
                    {e.nombre}
                  </Chip>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {fotoTipo === "pack"
                ? `Salen ${cantidadFotos} fotos: el producto real solo y una con modelo por cada estilo.`
                : `Salen ${cantidadFotos} foto${cantidadFotos === 1 ? "" : "s"}, una por estilo.`}
            </p>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-gray-700 mb-1.5">
            Texto escrito {modo === "FOTO" ? "sobre la foto" : "en el video"} (opcional)
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, 80))}
              placeholder="Ej.: NUEVO INGRESO · Consultá precio"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy"
            />
            <div className="flex gap-2">
              <Chip activo={textoPos === "arriba"} onClick={() => setTextoPos("arriba")}>
                Arriba
              </Chip>
              <Chip activo={textoPos === "abajo"} onClick={() => setTextoPos("abajo")}>
                Abajo
              </Chip>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {[producto, "Nuevo ingreso", "Consultá precio", "www.soloventas.com.ar"].map((t) => (
              <Chip key={t} activo={texto === t} onClick={() => setTexto(texto === t ? "" : t)}>
                {t}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            La IA lo escribe tal cual, en letra grande y sin tapar el producto. Dejalo vacío si no
            querés texto.
          </p>
        </div>

        <input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="Detalle extra (opcional): ej. luz de atardecer, tonos pastel, fondo con palmeras"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy"
        />
      </Paso>

      {/* 4. Con qué IA */}
      <Paso numero={4} titulo="¿Con qué IA?">
        {(modo === "FOTO" || panelVideo) && (
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1.5">
              ⭐ Gratis dentro de tu panel
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {modo === "VIDEO" ? (
                <TarjetaIA
                  activa={eleccion.clase === "panel"}
                  onClick={() => elegirIA({ clase: "panel", id: VIDEO_PANEL.id })}
                  nombre={VIDEO_PANEL.nombre}
                  empresa={VIDEO_PANEL.empresa}
                  detalle={VIDEO_PANEL.detalle}
                  etiqueta="Gratis"
                  recomendada
                />
              ) : (
                MODELOS_GRATIS.map((m) => (
                  <TarjetaIA
                    key={m.id}
                    activa={eleccion.clase === "panel" && modeloGratis.id === m.id}
                    onClick={() => elegirIA({ clase: "panel", id: m.id })}
                    nombre={m.nombre}
                    empresa={m.empresa}
                    detalle={`${m.nota} ${m.porDia}.`}
                    etiqueta="Gratis"
                    recomendada={m.recomendado}
                    apagada={!cfActivo}
                  />
                ))
              )}
            </div>
            {modo === "FOTO" && !cfActivo && (
              <p className="text-[11px] text-amber-700 mt-1.5">
                Para usarlas conectá la IA gratis arriba, en el Paso 1 · Conectar IAs.
              </p>
            )}
          </div>
        )}
        {falActivo && (modo === "FOTO" || !panelVideo) ? (
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1.5">
              Paga · la hace el panel solo, con un clic
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {modelos.map((m) => (
                <TarjetaIA
                  key={m.id}
                  activa={eleccion.clase === "paga" && modelo.id === m.id}
                  onClick={() => elegirIA({ clase: "paga", id: m.id })}
                  nombre={m.nombre}
                  empresa={m.empresa}
                  detalle={m.nota}
                  etiqueta={costoTexto(m, modo, duracion, cantidadFotos)}
                  recomendada={false}
                />
              ))}
            </div>
          </div>
        ) : (
          !falActivo && (
            <p className="text-[11px] text-gray-500">
              ¿Querés videos con una persona usando el artículo? Son con IA paga: conectala (opcional)
              en el Paso 1 · Conectar IAs.
            </p>
          )
        )}
      </Paso>

      {/* Vista previa de lo que va a hacer la IA elegida */}
      <VistaPreviaIA
        modo={modo}
        fotoTipo={fotoTipo}
        videoTipo={videoTipo}
        fotos={seleccionadas}
        escena={escena}
        persona={persona}
        formato={formato}
        duracion={duracion}
        texto={texto.trim()}
        textoPos={textoPos}
        nombreIA={
          eleccion.clase === "panel" ? nombrePanel : eleccion.clase === "gratis" ? herramienta.nombre : modelo.nombre
        }
        etiquetaIA={eleccion.clase === "paga" ? costo : eleccion.clase === "panel" ? "Gratis en tu panel" : "Gratis"}
        gratis={eleccion.clase !== "paga"}
        videoConFotos={modo === "VIDEO" && eleccion.clase === "panel"}
        estilos={ESTILOS.filter((e) => estilos.includes(e.id))}
      />

      {problema && <p className="text-sm text-amber-700">{problema}</p>}

      {/* 5. Hacerlo */}
      {eleccion.clase === "panel" ? (
        <div className="rounded-lg border border-green-200 bg-green-50/60 p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-green-900">
            Hacelo gratis acá mismo con {nombrePanel}
          </p>
          {modo === "FOTO" ? (
            cfActivo ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={generarGratis}
                  disabled={Boolean(problema) || enviando}
                  className="rounded-md bg-green-700 text-white text-sm font-semibold px-4 py-2 hover:opacity-90 disabled:opacity-50"
                >
                  {enviando
                    ? "Generando..."
                    : `${resultados.length > 0 ? "↻ Otra versión: " : ""}${
                        cantidadFotos > 1 ? `Generar ${cantidadFotos} fotos gratis` : "Generar foto gratis"
                      }`}
                </button>
                <span className="text-xs text-green-900">
                  Gratis · {modeloGratis.porDia} · tarda unos segundos
                </span>
              </div>
            ) : (
              <p className="text-sm text-green-900">
                Falta conectar la IA gratis: hacelo arriba en el <b>Paso 1 · Conectar IAs</b> (es
                una sola vez).
              </p>
            )
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={armarVideoGratis}
                  disabled={Boolean(problema) || progreso !== null || enviando}
                  className="rounded-md bg-green-700 text-white text-sm font-semibold px-4 py-2 hover:opacity-90 disabled:opacity-50"
                >
                  {progreso !== null
                    ? `Armando video... ${progreso}%`
                    : borradores.length > 0
                    ? "Armar otra versión"
                    : "Armar video gratis"}
                </button>
                <span className="text-xs text-green-900">
                  Gratis · {Math.max(duracion, seleccionadas.length * 3)} segundos, vertical para
                  Reels y TikTok · dejá esta pestaña abierta mientras se arma
                </span>
              </div>
              {borradores.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {borradores.map((b, i) => (
                    <div key={b.clave} className="flex flex-col gap-1.5">
                      <video
                        src={b.url}
                        controls
                        muted
                        playsInline
                        autoPlay={i === 0}
                        className="w-full rounded-md bg-black"
                      />
                      <button
                        type="button"
                        onClick={() => guardarVideo(b)}
                        disabled={enviando}
                        className="rounded-md bg-navy text-white text-xs font-semibold px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
                      >
                        {enviando ? "Guardando..." : "Me gusta, guardarlo"}
                      </button>
                      <button
                        type="button"
                        onClick={() => quitarBorrador(b.clave)}
                        className="text-xs text-red-600 underline"
                      >
                        Quitar
                      </button>
                      {b.extension === "webm" && (
                        <span className="text-[11px] text-amber-700">
                          Salió en WebM: para Instagram armalo desde Chrome actualizado (MP4).
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : eleccion.clase === "gratis" ? (
        <div className="rounded-lg border border-green-200 bg-green-50/60 p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-green-900">
              Hacelo gratis con {herramienta.nombre}
            </p>
            <a
              href={herramienta.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-green-700 text-white text-xs font-semibold px-3 py-1.5 hover:opacity-90"
            >
              Abrir {herramienta.nombre} ↗
            </a>
          </div>
          <ol className="text-sm text-green-950 list-decimal pl-5 flex flex-col gap-1">
            <li>
              Guardá la foto de base:{" "}
              {seleccionadas.map((f, i) => (
                <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="underline mr-2">
                  abrir foto {i + 1}
                </a>
              ))}
              (clic derecho → Guardar imagen).
            </li>
            <li>
              Copiá la instrucción de abajo y abrí {herramienta.nombre}. {pasos}
              {cantidadFotos > 1 && " Para cada foto, pegá su instrucción (1, 2, 3...)."}
            </li>
            <li>
              Descargá el resultado y subilo arriba en <b>Fotos y videos</b>, tildando{" "}
              <i>&quot;Son fotos o videos generados con IA&quot;</i>.
              {cantidadFotos > 1 && " Para publicarlas juntas elegí “Carrusel” en Publicar en redes."}
            </li>
          </ol>
          {prompts.map((p, i) => (
            <div key={p.titulo} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-green-900">
                  {prompts.length > 1 ? `Instrucción ${i + 1} · ` : ""}
                  {p.titulo}
                </p>
                <button
                  type="button"
                  onClick={() => copiar(i)}
                  disabled={Boolean(problema)}
                  className="rounded-md bg-white border border-green-700 text-green-800 text-xs font-semibold px-3 py-1.5 hover:bg-green-100 disabled:opacity-50"
                >
                  {copiado === i ? "✓ Copiada" : `Copiar instrucción${prompts.length > 1 ? ` ${i + 1}` : ""}`}
                </button>
              </div>
              <textarea
                readOnly
                value={p.prompt}
                rows={3}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded-md border border-green-200 bg-white px-3 py-2 text-xs text-gray-700 font-mono"
              />
            </div>
          ))}
          <p className="text-xs text-green-900/80">
            La instrucción va en inglés porque las IA la entienden mejor. Si el resultado cambia el
            producto, pedile en el mismo chat: &quot;keep the product exactly as in the original
            photo&quot;.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold text-violet-900">
            Hacelo automático con {modelo.nombre}
          </p>
          {falActivo ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={generar}
                disabled={Boolean(problema) || enviando}
                className="rounded-md bg-violet-700 text-white text-sm font-semibold px-4 py-2 hover:opacity-90 disabled:opacity-50"
              >
                {enviando
                  ? "Enviando..."
                  : `${resultados.length > 0 ? "↻ Otra versión: " : ""}${
                      modo === "FOTO" ? (cantidadFotos > 1 ? `Generar ${cantidadFotos} fotos` : "Generar foto") : "Generar video"
                    }`}
              </button>
              <span className="text-xs text-violet-900">
                Costo: {costo}
                {modo === "VIDEO" ? " · tarda 1 a 5 minutos" : " · tarda unos segundos"}
              </span>
            </div>
          ) : (
            <p className="text-sm text-violet-900">
              Para usarla, conectá fal.ai arriba en el <b>Paso 1 · Conectar IAs</b> (opcional, pago
              por uso).
            </p>
          )}
        </div>
      )}

      {resultados.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-navy">
                Así quedó · {resultados.length} versión{resultados.length === 1 ? "" : "es"}
              </p>
              <p className="text-xs text-gray-500">
                Tocá &quot;Más opciones como esta&quot; en la que te guste, o probá otras IA o estilos
                arriba: cada versión nueva se suma acá y no se borra nada hasta que vos la descartes. Marcá las que te gusten (de cualquier IA) y publicalas
                juntas.
              </p>
            </div>
            <button
              type="button"
              onClick={actualizar}
              disabled={ocupado !== null}
              className="rounded-md border border-gray-300 text-gray-700 text-xs font-semibold px-3 py-1.5 hover:border-navy disabled:opacity-50"
            >
              {ocupado === "actualizar" ? "Actualizando..." : "↻ Actualizar"}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {resultados.map((t) => {
              const m = t.media!;
              const pos = elegidas.indexOf(m.id);
              return (
                <div
                  key={m.id}
                  className={`rounded-lg border-2 p-1.5 flex flex-col gap-1.5 ${
                    pos >= 0 ? "border-navy bg-navy/5" : "border-gray-200"
                  }`}
                >
                  <button type="button" onClick={() => alternarElegida(m.id)} className="relative block">
                    {m.tipo === "FOTO" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt="" className="w-full aspect-[4/5] rounded-md object-cover bg-gray-50" />
                    ) : (
                      <video
                        src={m.url}
                        muted
                        playsInline
                        controls
                        className="w-full aspect-[4/5] rounded-md bg-black object-cover"
                      />
                    )}
                    <span
                      className={`absolute top-1.5 left-1.5 min-w-6 h-6 px-1 rounded-full text-[11px] font-bold flex items-center justify-center border-2 ${
                        pos >= 0 ? "bg-navy text-white border-white" : "bg-white/90 text-gray-500 border-gray-300"
                      }`}
                    >
                      {pos >= 0 ? pos + 1 : ""}
                    </span>
                  </button>
                  <p className="text-[11px] text-gray-600 leading-tight">
                    <b>{nombreDeIA(t.modelo)}</b> ·{" "}
                    {new Date(t.createdAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                    {m.aprobado && <span className="text-green-700"> · ✓ aprobada</span>}
                  </p>
                  {m.tipo === "FOTO" && cfActivo && (
                    <button
                      type="button"
                      onClick={() => masComoEsta(t)}
                      disabled={ocupado !== null || enviando}
                      className="rounded-md border border-green-600 text-green-800 bg-green-50 text-xs font-semibold px-2 py-1 hover:bg-green-100 disabled:opacity-50"
                    >
                      {ocupado === `variar-${t.id}` ? "Buscando opciones..." : "↻ Más opciones como esta"}
                    </button>
                  )}
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => usarResultados([m])}
                      disabled={ocupado !== null}
                      className="text-xs font-semibold text-navy underline disabled:opacity-50"
                    >
                      {ocupado === m.id ? "Preparando..." : "Publicar sola"}
                    </button>
                    <button
                      type="button"
                      onClick={() => descartar(m)}
                      disabled={ocupado !== null}
                      className="text-xs text-red-600 underline disabled:opacity-50"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {elegidas.length > 0 && (
            <div className="sticky bottom-2 rounded-lg bg-navy text-white p-3 flex flex-wrap items-center justify-between gap-2 shadow-lg">
              <span className="text-sm">
                {elegidas.length} elegida{elegidas.length === 1 ? "" : "s"}
                {mezclaTipos && " · no se pueden mezclar fotos y videos"}
                {variosVideos && " · elegí un solo video"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setElegidas([])}
                  className="text-xs underline text-white/80"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={() => usarResultados(mediasElegidas)}
                  disabled={ocupado !== null || mezclaTipos || variosVideos}
                  className="rounded-md bg-gold text-white text-sm font-semibold px-4 py-2 hover:opacity-90 disabled:opacity-50"
                >
                  {ocupado && ocupado !== "actualizar" && !ocupado.startsWith("variar-")
                    ? "Preparando..."
                    : elegidas.length > 1
                    ? `Publicar las ${elegidas.length} juntas (carrusel)`
                    : "Publicar"}
                </button>
              </div>
            </div>
          )}
          <p className="text-[11px] text-gray-500">
            En el paso de publicar también podés sumar al carrusel las fotos originales del producto.
          </p>
        </div>
      )}

      {otrosTrabajos.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-gray-700">Pedidos a la IA</p>
          <ul className="flex flex-col gap-1.5">
            {otrosTrabajos.map((t) => (
              <li key={t.id} className="text-sm flex flex-wrap items-center gap-x-3">
                <span className="font-medium">{t.tipo === "FOTO" ? "Foto" : "Video"}</span>
                <span className="text-xs text-gray-500">
                  {new Date(t.createdAt).toLocaleString("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                {t.estado === "PENDIENTE" && (
                  <span className="text-xs font-semibold text-amber-600">Generando...</span>
                )}
                {t.estado === "LISTO" && (
                  <span className="text-xs text-gray-500">Listo (el archivo ya no está)</span>
                )}
                {t.estado === "ERROR" && (
                  <span className="text-xs text-red-600">No se pudo: {t.error}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <p className="text-xs text-gray-500">
        Instagram, Facebook y TikTok pueden mostrar la etiqueta &quot;Hecho con IA&quot; en estas
        publicaciones. Es normal: indica que la imagen fue creada con IA.
      </p>
    </div>
  );
}
