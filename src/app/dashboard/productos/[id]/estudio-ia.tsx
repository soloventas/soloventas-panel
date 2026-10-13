"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Media } from "./media-manager";
import {
  ESCENAS,
  FOTO_TIPOS,
  FORMATOS,
  PERSONAS,
  VIDEO_TIPOS,
  promptVideo,
  promptsFotos,
  type EscenaId,
  type FotoTipoId,
  type FormatoId,
  type PersonaId,
  type VideoTipoId,
} from "@/lib/estudio";
import {
  MODELO_AUTO_DEFECTO,
  buscarModelo,
  costoTexto,
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
};

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
};

const ICONOS_FOTO: Record<FotoTipoId, string> = {
  pack: "👩‍🦰",
  escena: "🏝️",
  catalogo: "⬜",
  mejorar: "✨",
};
const ICONOS_VIDEO: Record<VideoTipoId, string> = {
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
  ...VIDEO_TIPOS.map((v) => ({
    id: `video-${v.id}`,
    modo: "VIDEO" as Modo,
    videoTipo: v.id,
    icono: ICONOS_VIDEO[v.id],
    nombre: `Video: ${v.nombre}`,
    ayuda: v.ayuda,
  })),
];

// La IA elegida: una web gratis o un modelo pago automático.
type EleccionIA = { clase: "gratis" | "paga"; id: string };

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
  onNuevos,
}: {
  productoId: string;
  producto: string;
  fotos: Media[];
  falActivo: boolean;
  onNuevos: () => void;
}) {
  const [tareaId, setTareaId] = useState(TAREAS[0].id);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [escena, setEscena] = useState<EscenaId>("playa");
  const [escenaPersonalizada, setEscenaPersonalizada] = useState("");
  const [persona, setPersona] = useState<PersonaId>("mujer");
  const [formato, setFormato] = useState<FormatoId>("4:5");
  const [duracion, setDuracion] = useState<5 | 10>(5);
  // Por defecto, la recomendada: paga si está la clave de fal.ai, si no la gratis.
  const [ia, setIa] = useState<Record<Modo, EleccionIA>>(() =>
    falActivo
      ? {
          FOTO: { clase: "paga", id: MODELO_AUTO_DEFECTO.FOTO },
          VIDEO: { clase: "paga", id: MODELO_AUTO_DEFECTO.VIDEO },
        }
      : {
          FOTO: { clase: "gratis", id: herramientasPara("FOTO")[0].id },
          VIDEO: { clase: "gratis", id: herramientasPara("VIDEO")[0].id },
        }
  );
  const [verTodas, setVerTodas] = useState(false);
  const [extra, setExtra] = useState("");
  const [copiado, setCopiado] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const listosAntes = useRef<Set<string>>(new Set());
  const inicializado = useRef(false);

  const tarea = TAREAS.find((t) => t.id === tareaId) || TAREAS[0];
  const modo = tarea.modo;
  const fotoTipo: FotoTipoId = tarea.fotoTipo || "pack";
  const videoTipo: VideoTipoId = tarea.videoTipo || "giro";
  const herramientaFoto = FOTO_TIPOS.find((f) => f.id === fotoTipo)!;
  const usaEscena = modo === "VIDEO" || herramientaFoto.usaEscena;
  const usaPersona = modo === "FOTO" ? herramientaFoto.usaPersona : videoTipo === "persona";
  const maxSeleccion = modo === "FOTO" ? 4 : 2;

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
      return promptsFotos(fotoTipo, { producto, escena, escenaPersonalizada, persona, formato, extra });
    }
    return [
      {
        titulo: "Video",
        prompt: promptVideo({ producto, tipo: videoTipo, escena, escenaPersonalizada, persona, extra }),
      },
    ];
  }, [modo, fotoTipo, producto, escena, escenaPersonalizada, persona, formato, videoTipo, extra]);

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
  const cantidadFotos = modo === "FOTO" ? prompts.length : 0;
  const costo = costoTexto(modelo, modo, duracion, cantidadFotos);

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
        ? cantidadFotos === 2
          ? "2 fotos (producto real + con modelo)"
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

  const seleccionadas = seleccion
    .map((id) => fotos.find((f) => f.id === id))
    .filter((f): f is Media => Boolean(f));

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
          {TAREAS.map((t) => (
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
          <p className="text-xs text-gray-500">La foto 1 es el inicio del video y la 2, el final.</p>
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

        <input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="Detalle extra (opcional): ej. luz de atardecer, tonos pastel, fondo con palmeras"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy"
        />
      </Paso>

      {/* 4. Con qué IA */}
      <Paso numero={4} titulo="¿Con qué IA?">
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1.5">
            Gratis · la usás en su web, el panel te arma la instrucción
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {herramientasVisibles.map((h) => (
              <TarjetaIA
                key={h.id}
                activa={eleccion.clase === "gratis" && herramienta.id === h.id}
                onClick={() => elegirIA({ clase: "gratis", id: h.id })}
                nombre={h.nombre}
                empresa={h.empresa}
                detalle={h.plan}
                etiqueta="Gratis"
                recomendada={h.recomendado?.includes(modo)}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5">
            <p className="text-[11px] text-gray-400">
              Los límites gratis los pone cada empresa y pueden cambiar.
            </p>
            {herramientas.length > herramientasVisibles.length || verTodas ? (
              <button
                type="button"
                onClick={() => setVerTodas((v) => !v)}
                className="text-xs font-semibold text-navy underline"
              >
                {verTodas ? "Ver menos" : `Ver todas las gratis (${herramientas.length})`}
              </button>
            ) : null}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1.5">
            Paga · la hace el panel solo, con un clic
            {!falActivo && " (necesita activar fal.ai)"}
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
                recomendada={m.recomendado}
                apagada={!falActivo}
              />
            ))}
          </div>
        </div>
      </Paso>

      {problema && <p className="text-sm text-amber-700">{problema}</p>}

      {/* 5. Hacerlo */}
      {eleccion.clase === "gratis" ? (
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
              {cantidadFotos === 2 && " Para la segunda foto, pegá la instrucción 2."}
            </li>
            <li>
              Descargá el resultado y subilo arriba en <b>Fotos y videos</b>, tildando{" "}
              <i>&quot;Son fotos o videos generados con IA&quot;</i>.
              {cantidadFotos === 2 && " Para publicarlas juntas elegí “Carrusel” en Publicar en redes."}
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
                  : modo === "FOTO"
                  ? cantidadFotos === 2
                    ? "Generar 2 fotos"
                    : "Generar foto"
                  : "Generar video"}
              </button>
              <span className="text-xs text-violet-900">
                Costo: {costo}
                {modo === "VIDEO" ? " · tarda 1 a 5 minutos" : " · tarda unos segundos"}
              </span>
            </div>
          ) : (
            <p className="text-sm text-violet-900">
              Para activarlo, cargá la clave <code className="bg-white/70 px-1 rounded">FAL_KEY</code>{" "}
              en Vercel (cuenta en fal.ai, pago por uso). Mientras tanto elegí una IA gratis.
            </p>
          )}
        </div>
      )}

      {trabajos.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-gray-700">Lo que le pediste a la IA</p>
          <ul className="flex flex-col gap-1.5">
            {trabajos.map((t) => (
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
                  <span className="text-xs font-semibold text-green-700">
                    Listo · revisalo arriba y aprobalo
                  </span>
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
