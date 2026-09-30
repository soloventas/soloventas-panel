"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Media } from "./media-manager";
import {
  COSTO_FOTO,
  COSTO_VIDEO_SEG,
  ESCENAS,
  FORMATOS,
  PERSONAS,
  VIDEO_TIPOS,
  promptVideo,
  promptsPackFoto,
  type CalidadId,
  type EscenaId,
  type FormatoId,
  type PersonaId,
  type VideoTipoId,
} from "@/lib/estudio";

type Modo = "FOTO" | "VIDEO";

type Trabajo = {
  id: string;
  tipo: Modo;
  estado: "PENDIENTE" | "LISTO" | "ERROR";
  error: string | null;
  createdAt: string;
};

function Chip({
  activo,
  onClick,
  children,
  disabled,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-3 py-1.5 text-xs border transition ${
        activo
          ? "bg-navy text-white border-navy"
          : "bg-white text-gray-700 border-gray-300 hover:border-navy"
      } disabled:opacity-40`}
    >
      {children}
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
  const [modo, setModo] = useState<Modo>("FOTO");
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [escena, setEscena] = useState<EscenaId>("playa");
  const [escenaPersonalizada, setEscenaPersonalizada] = useState("");
  const [persona, setPersona] = useState<PersonaId>("mujer");
  const [formato, setFormato] = useState<FormatoId>("4:5");
  const [videoTipo, setVideoTipo] = useState<VideoTipoId>("giro");
  const [duracion, setDuracion] = useState<5 | 10>(5);
  const [calidad, setCalidad] = useState<CalidadId>("estandar");
  const [extra, setExtra] = useState("");
  const [copiado, setCopiado] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const listosAntes = useRef<Set<string>>(new Set());
  const inicializado = useRef(false);

  const maxSeleccion = modo === "FOTO" ? 4 : 2;

  // Por defecto usamos la primera foto como base.
  useEffect(() => {
    setSeleccion((prev) => {
      const validas = prev.filter((id) => fotos.some((f) => f.id === id)).slice(0, maxSeleccion);
      if (validas.length > 0) return validas;
      return fotos[0] ? [fotos[0].id] : [];
    });
  }, [fotos, maxSeleccion]);

  // En fotos siempre sale el pack de 2 (producto real + con modelo), para
  // publicarlas juntas como carrusel.
  const prompts = useMemo(() => {
    if (modo === "FOTO") {
      return promptsPackFoto({ producto, escena, escenaPersonalizada, persona, formato, extra });
    }
    return [
      {
        titulo: "Video",
        prompt: promptVideo({ producto, tipo: videoTipo, escena, escenaPersonalizada, persona, extra }),
      },
    ];
  }, [modo, producto, escena, escenaPersonalizada, persona, formato, videoTipo, extra]);

  const costo =
    modo === "FOTO" ? COSTO_FOTO[calidad] * 2 : COSTO_VIDEO_SEG[calidad] * duracion;

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
    if (escena === "personalizada" && !escenaPersonalizada.trim())
      return "Describí el lugar que querés.";
    return null;
  })();

  async function generar() {
    if (problema) return;
    const que =
      modo === "FOTO" ? "2 fotos (producto real + con modelo)" : `un video de ${duracion} segundos`;
    if (!confirm(`¿Generar ${que} con IA? Costo aproximado: US$ ${costo.toFixed(2)}.`)) return;
    setError("");
    setEnviando(true);
    const r = await fetch("/api/ia/estudio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productoId,
        tipo: modo,
        mediaIds: seleccion,
        calidad,
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
          Subí al menos una foto real del producto para crear fotos y videos con IA.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-gold">Estudio IA</p>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {(["FOTO", "VIDEO"] as Modo[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`rounded-md px-3 py-1 text-sm ${
                modo === m ? "bg-white shadow-sm font-semibold text-navy" : "text-gray-600"
              }`}
            >
              {m === "FOTO" ? "✨ Foto con IA" : "🎬 Video con IA"}
            </button>
          ))}
        </div>
      </div>

      {/* Fotos de base */}
      <div>
        <p className="text-sm font-medium mb-1">
          {modo === "FOTO" ? "Foto(s) del producto" : "Foto(s) de base del video"}{" "}
          <span className="text-gray-400 font-normal">
            (hasta {maxSeleccion}
            {modo === "VIDEO" ? ": la primera es el inicio y la segunda el final" : ""})
          </span>
        </p>
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
      </div>

      {/* Tipo de video */}
      {modo === "VIDEO" && (
        <div>
          <p className="text-sm font-medium mb-2">Tipo de video</p>
          <div className="flex flex-wrap gap-2">
            {VIDEO_TIPOS.map((v) => (
              <Chip key={v.id} activo={videoTipo === v.id} onClick={() => setVideoTipo(v.id)}>
                {v.nombre}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            {VIDEO_TIPOS.find((v) => v.id === videoTipo)?.ayuda}
          </p>
        </div>
      )}

      {/* Escena */}
      <div>
        <p className="text-sm font-medium mb-2">Lugar / ambiente</p>
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

      {/* Persona */}
      {(modo === "FOTO" || videoTipo === "persona") && (
        <div>
          <p className="text-sm font-medium mb-2">¿Quién aparece?</p>
          <div className="flex flex-wrap gap-2">
            {PERSONAS.filter((p) => p.id !== "ninguna").map((p) => (
              <Chip key={p.id} activo={persona === p.id} onClick={() => setPersona(p.id)}>
                {p.nombre}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            Siempre son personas adultas creadas por IA, que no existen.
            {modo === "FOTO" &&
              " Se arman 2 fotos: el producto real solo y el producto usado por la modelo en el lugar elegido."}
          </p>
        </div>
      )}

      {/* Formato / duración */}
      <div className="flex flex-wrap gap-6">
        {modo === "FOTO" ? (
          <div>
            <p className="text-sm font-medium mb-2">Formato</p>
            <div className="flex flex-wrap gap-2">
              {FORMATOS.map((f) => (
                <Chip key={f.id} activo={formato === f.id} onClick={() => setFormato(f.id)}>
                  {f.nombre}
                </Chip>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium mb-2">Duración</p>
            <div className="flex gap-2">
              {[5, 10].map((d) => (
                <Chip key={d} activo={duracion === d} onClick={() => setDuracion(d as 5 | 10)}>
                  {d} segundos
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      <input
        value={extra}
        onChange={(e) => setExtra(e.target.value)}
        placeholder="Detalle extra (opcional): ej. luz de atardecer, tonos pastel, fondo con palmeras"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy"
      />

      {problema && <p className="text-xs text-amber-700">{problema}</p>}

      {/* Modo gratis */}
      <div className="rounded-lg border border-green-200 bg-green-50/60 p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-green-900">
            Modo gratis {modo === "FOTO" ? "con Gemini" : "con Google AI Studio (Veo)"}
          </p>
        </div>
        <ol className="text-sm text-green-950 list-decimal pl-5 flex flex-col gap-1">
          <li>
            Guardá la foto de base en tu compu o celular:{" "}
            {seleccionadas.map((f, i) => (
              <a
                key={f.id}
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="underline mr-2"
              >
                abrir foto {i + 1}
              </a>
            ))}
            (en la foto, clic derecho → Guardar imagen).
          </li>
          <li>
            Abrí{" "}
            {modo === "FOTO" ? (
              <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer" className="underline font-medium">
                Gemini
              </a>
            ) : (
              <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="underline font-medium">
                Google AI Studio
              </a>
            )}{" "}
            {modo === "FOTO"
              ? "con tu cuenta de Google, adjuntá la foto con el botón + y pegá la instrucción 1. Descargá el resultado y, en el mismo chat, pegá la instrucción 2."
              : "con tu cuenta de Google, elegí generar video (Veo), adjuntá la foto y pegá la instrucción."}
          </li>
          <li>Descargá {modo === "FOTO" ? "las 2 fotos" : "el resultado"} que te devuelve.</li>
          <li>
            {modo === "FOTO" ? "Subilas" : "Subilo"} arriba en <b>Fotos y videos</b>, tildando{" "}
            <i>&quot;Son fotos o videos generados con IA&quot;</i>. Después las revisás y las aprobás.
            {modo === "FOTO" &&
              " Para publicarlas juntas elegí “Carrusel” en Publicar en redes."}
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
                className="rounded-md bg-green-700 text-white text-xs font-semibold px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
              >
                {copiado === i ? "✓ Copiada" : `Copiar instrucción${prompts.length > 1 ? ` ${i + 1}` : ""}`}
              </button>
            </div>
            <textarea
              readOnly
              value={p.prompt}
              rows={4}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-md border border-green-200 bg-white px-3 py-2 text-xs text-gray-700 font-mono"
            />
          </div>
        ))}
        <p className="text-xs text-green-900/80">
          La instrucción va en inglés porque las IA la entienden mejor. Si el resultado cambia el
          producto (color, logo, forma), pedile en el mismo chat: &quot;keep the product exactly as in
          the original photo&quot;.
        </p>
      </div>

      {/* Modo automático */}
      <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-violet-900">Modo automático (fal.ai)</p>
          <div className="flex gap-2">
            {(["estandar", "premium"] as CalidadId[]).map((c) => (
              <Chip key={c} activo={calidad === c} onClick={() => setCalidad(c)}>
                {c === "estandar" ? "Estándar" : "Premium"}
              </Chip>
            ))}
          </div>
        </div>
        {falActivo ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={generar}
              disabled={Boolean(problema) || enviando}
              className="rounded-md bg-violet-700 text-white text-sm font-semibold px-4 py-2 hover:opacity-90 disabled:opacity-50"
            >
              {enviando ? "Enviando..." : modo === "FOTO" ? "Generar 2 fotos" : "Generar video"}
            </button>
            <span className="text-xs text-violet-900">
              Costo aproximado: US$ {costo.toFixed(2)}
              {modo === "VIDEO" ? " · tarda 1 a 5 minutos" : " · tarda unos segundos"}
            </span>
          </div>
        ) : (
          <p className="text-sm text-violet-900">
            Genera todo desde el panel con un clic, sin salir. Para activarlo, cargá la clave{" "}
            <code className="bg-white/70 px-1 rounded">FAL_KEY</code> en Vercel (cuenta en fal.ai,
            pago por uso: foto ≈ US$ {COSTO_FOTO.estandar.toFixed(2)}, video de 5 s ≈ US${" "}
            {(COSTO_VIDEO_SEG.estandar * 5).toFixed(2)}).
          </p>
        )}

        {trabajos.length > 0 && (
          <ul className="flex flex-col gap-1.5 border-t border-violet-200 pt-3">
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
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <p className="text-xs text-gray-500">
        Instagram, Facebook y TikTok pueden mostrar la etiqueta &quot;Hecho con IA&quot; en estas
        publicaciones. Es normal: indica que la imagen fue creada con IA.
      </p>
    </div>
  );
}
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Media } from "./media-manager";
import {
  COSTO_FOTO,
  COSTO_VIDEO_SEG,
  ESCENAS,
  FORMATOS,
  PERSONAS,
  VIDEO_TIPOS,
  promptFoto,
  promptVideo,
  type CalidadId,
  type EscenaId,
  type FormatoId,
  type PersonaId,
  type VideoTipoId,
} from "@/lib/estudio";

type Modo = "FOTO" | "VIDEO";

type Trabajo = {
  id: string;
  tipo: Modo;
  estado: "PENDIENTE" | "LISTO" | "ERROR";
  error: string | null;
  createdAt: string;
};

function Chip({
  activo,
  onClick,
  children,
  disabled,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-3 py-1.5 text-xs border transition ${
        activo
          ? "bg-navy text-white border-navy"
          : "bg-white text-gray-700 border-gray-300 hover:border-navy"
      } disabled:opacity-40`}
    >
      {children}
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
  const [modo, setModo] = useState<Modo>("FOTO");
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [escena, setEscena] = useState<EscenaId>("playa");
  const [escenaPersonalizada, setEscenaPersonalizada] = useState("");
  const [persona, setPersona] = useState<PersonaId>("mujer");
  const [formato, setFormato] = useState<FormatoId>("4:5");
  const [videoTipo, setVideoTipo] = useState<VideoTipoId>("giro");
  const [duracion, setDuracion] = useState<5 | 10>(5);
  const [calidad, setCalidad] = useState<CalidadId>("estandar");
  const [extra, setExtra] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const listosAntes = useRef<Set<string>>(new Set());
  const inicializado = useRef(false);

  const maxSeleccion = modo === "FOTO" ? 4 : 2;

  // Por defecto usamos la primera foto como base.
  useEffect(() => {
    setSeleccion((prev) => {
      const validas = prev.filter((id) => fotos.some((f) => f.id === id)).slice(0, maxSeleccion);
      if (validas.length > 0) return validas;
      return fotos[0] ? [fotos[0].id] : [];
    });
  }, [fotos, maxSeleccion]);

  const prompt = useMemo(() => {
    if (modo === "FOTO") {
      return promptFoto({ producto, escena, escenaPersonalizada, persona, formato, extra });
    }
    return promptVideo({ producto, tipo: videoTipo, escena, escenaPersonalizada, persona, extra });
  }, [modo, producto, escena, escenaPersonalizada, persona, formato, videoTipo, extra]);

  const costo =
    modo === "FOTO" ? COSTO_FOTO[calidad] : COSTO_VIDEO_SEG[calidad] * duracion;

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

  async function copiar() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setError("No se pudo copiar. Seleccioná el texto y copialo a mano.");
    }
  }

  const problema = (() => {
    if (seleccion.length === 0) return "Elegí al menos una foto de base.";
    if (modo === "VIDEO" && videoTipo === "colores" && seleccion.length < 2)
      return "Para el cambio de color elegí 2 fotos en distintos colores.";
    if (escena === "personalizada" && !escenaPersonalizada.trim())
      return "Describí el lugar que querés.";
    return null;
  })();

  async function generar() {
    if (problema) return;
    const que = modo === "FOTO" ? "una foto" : `un video de ${duracion} segundos`;
    if (!confirm(`¿Generar ${que} con IA? Costo aproximado: US$ ${costo.toFixed(2)}.`)) return;
    setError("");
    setEnviando(true);
    const r = await fetch("/api/ia/estudio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productoId,
        tipo: modo,
        mediaIds: seleccion,
        calidad,
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
          Subí al menos una foto real del producto para crear fotos y videos con IA.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-gold">Estudio IA</p>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {(["FOTO", "VIDEO"] as Modo[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`rounded-md px-3 py-1 text-sm ${
                modo === m ? "bg-white shadow-sm font-semibold text-navy" : "text-gray-600"
              }`}
            >
              {m === "FOTO" ? "✨ Foto con IA" : "🎬 Video con IA"}
            </button>
          ))}
        </div>
      </div>

      {/* Fotos de base */}
      <div>
        <p className="text-sm font-medium mb-1">
          {modo === "FOTO" ? "Foto(s) del producto" : "Foto(s) de base del video"}{" "}
          <span className="text-gray-400 font-normal">
            (hasta {maxSeleccion}
            {modo === "VIDEO" ? ": la primera es el inicio y la segunda el final" : ""})
          </span>
        </p>
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
      </div>

      {/* Tipo de video */}
      {modo === "VIDEO" && (
        <div>
          <p className="text-sm font-medium mb-2">Tipo de video</p>
          <div className="flex flex-wrap gap-2">
            {VIDEO_TIPOS.map((v) => (
              <Chip key={v.id} activo={videoTipo === v.id} onClick={() => setVideoTipo(v.id)}>
                {v.nombre}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            {VIDEO_TIPOS.find((v) => v.id === videoTipo)?.ayuda}
          </p>
        </div>
      )}

      {/* Escena */}
      <div>
        <p className="text-sm font-medium mb-2">Lugar / ambiente</p>
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

      {/* Persona */}
      {(modo === "FOTO" || videoTipo === "persona") && (
        <div>
          <p className="text-sm font-medium mb-2">¿Quién aparece?</p>
          <div className="flex flex-wrap gap-2">
            {PERSONAS.filter((p) => modo === "FOTO" || p.id !== "ninguna").map((p) => (
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

      {/* Formato / duración */}
      <div className="flex flex-wrap gap-6">
        {modo === "FOTO" ? (
          <div>
            <p className="text-sm font-medium mb-2">Formato</p>
            <div className="flex flex-wrap gap-2">
              {FORMATOS.map((f) => (
                <Chip key={f.id} activo={formato === f.id} onClick={() => setFormato(f.id)}>
                  {f.nombre}
                </Chip>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium mb-2">Duración</p>
            <div className="flex gap-2">
              {[5, 10].map((d) => (
                <Chip key={d} activo={duracion === d} onClick={() => setDuracion(d as 5 | 10)}>
                  {d} segundos
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      <input
        value={extra}
        onChange={(e) => setExtra(e.target.value)}
        placeholder="Detalle extra (opcional): ej. luz de atardecer, tonos pastel, fondo con palmeras"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-navy"
      />

      {problema && <p className="text-xs text-amber-700">{problema}</p>}

      {/* Modo gratis */}
      <div className="rounded-lg border border-green-200 bg-green-50/60 p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-green-900">
            Modo gratis {modo === "FOTO" ? "con Gemini" : "con Google AI Studio (Veo)"}
          </p>
          <button
            type="button"
            onClick={copiar}
            disabled={Boolean(problema)}
            className="rounded-md bg-green-700 text-white text-sm font-semibold px-4 py-2 hover:opacity-90 disabled:opacity-50"
          >
            {copiado ? "✓ Copiada" : "Copiar instrucción"}
          </button>
        </div>
        <ol className="text-sm text-green-950 list-decimal pl-5 flex flex-col gap-1">
          <li>
            Guardá la foto de base en tu compu o celular:{" "}
            {seleccionadas.map((f, i) => (
              <a
                key={f.id}
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="underline mr-2"
              >
                abrir foto {i + 1}
              </a>
            ))}
            (en la foto, clic derecho → Guardar imagen).
          </li>
          <li>
            Abrí{" "}
            {modo === "FOTO" ? (
              <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer" className="underline font-medium">
                Gemini
              </a>
            ) : (
              <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="underline font-medium">
                Google AI Studio
              </a>
            )}{" "}
            {modo === "FOTO"
              ? "con tu cuenta de Google, adjuntá la foto con el botón + y pegá la instrucción."
              : "con tu cuenta de Google, elegí generar video (Veo), adjuntá la foto y pegá la instrucción."}
          </li>
          <li>Descargá el resultado que te devuelve.</li>
          <li>
            Subilo arriba en <b>Fotos y videos</b>, tildando{" "}
            <i>&quot;Son fotos o videos generados con IA&quot;</i>. Después lo revisás y lo aprobás.
          </li>
        </ol>
        <textarea
          readOnly
          value={prompt}
          rows={5}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-md border border-green-200 bg-white px-3 py-2 text-xs text-gray-700 font-mono"
        />
        <p className="text-xs text-green-900/80">
          La instrucción va en inglés porque las IA la entienden mejor. Si el resultado cambia el
          producto (color, logo, forma), pedile en el mismo chat: &quot;keep the product exactly as in
          the original photo&quot;.
        </p>
      </div>

      {/* Modo automático */}
      <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-violet-900">Modo automático (fal.ai)</p>
          <div className="flex gap-2">
            {(["estandar", "premium"] as CalidadId[]).map((c) => (
              <Chip key={c} activo={calidad === c} onClick={() => setCalidad(c)}>
                {c === "estandar" ? "Estándar" : "Premium"}
              </Chip>
            ))}
          </div>
        </div>
        {falActivo ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={generar}
              disabled={Boolean(problema) || enviando}
              className="rounded-md bg-violet-700 text-white text-sm font-semibold px-4 py-2 hover:opacity-90 disabled:opacity-50"
            >
              {enviando ? "Enviando..." : modo === "FOTO" ? "Generar foto" : "Generar video"}
            </button>
            <span className="text-xs text-violet-900">
              Costo aproximado: US$ {costo.toFixed(2)}
              {modo === "VIDEO" ? " · tarda 1 a 5 minutos" : " · tarda unos segundos"}
            </span>
          </div>
        ) : (
          <p className="text-sm text-violet-900">
            Genera todo desde el panel con un clic, sin salir. Para activarlo, cargá la clave{" "}
            <code className="bg-white/70 px-1 rounded">FAL_KEY</code> en Vercel (cuenta en fal.ai,
            pago por uso: foto ≈ US$ {COSTO_FOTO.estandar.toFixed(2)}, video de 5 s ≈ US${" "}
            {(COSTO_VIDEO_SEG.estandar * 5).toFixed(2)}).
          </p>
        )}

        {trabajos.length > 0 && (
          <ul className="flex flex-col gap-1.5 border-t border-violet-200 pt-3">
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
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <p className="text-xs text-gray-500">
        Instagram, Facebook y TikTok pueden mostrar la etiqueta &quot;Hecho con IA&quot; en estas
        publicaciones. Es normal: indica que la imagen fue creada con IA.
      </p>
    </div>
  );
}
