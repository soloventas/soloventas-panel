"use client";

import type { Media } from "./media-manager";
import type { EscenaId, FormatoId, FotoTipoId, PersonaId, TextoPosId, VideoTipoId } from "@/lib/estudio";

// Vista previa de lo que se le va a pedir a la IA: arma un boceto con las
// fotos de base, el formato, el ambiente y el texto elegido. Es una
// simulación: la imagen final la crea la IA.

const FONDOS: Record<EscenaId, string> = {
  playa: "linear-gradient(180deg,#7dd3fc 0%,#bae6fd 45%,#fde68a 100%)",
  ciudad: "linear-gradient(180deg,#cbd5e1 0%,#94a3b8 60%,#64748b 100%)",
  cafe: "linear-gradient(180deg,#fcd9b6 0%,#d6a77a 60%,#8b5e3c 100%)",
  estudio: "linear-gradient(180deg,#f8fafc 0%,#e2e8f0 100%)",
  naturaleza: "linear-gradient(180deg,#bbf7d0 0%,#86efac 50%,#4d7c0f 100%)",
  noche: "linear-gradient(180deg,#0f172a 0%,#312e81 60%,#1e1b4b 100%)",
  personalizada: "linear-gradient(180deg,#ede9fe 0%,#c4b5fd 100%)",
};

const PROPORCION: Record<FormatoId, string> = {
  "1:1": "1 / 1",
  "4:5": "4 / 5",
  "9:16": "9 / 16",
};

type Cuadro = {
  titulo: string;
  foto?: Media;
  fondo: string;
  proporcion: string;
  persona?: PersonaId;
  filtro?: string;
  video?: boolean;
  final?: Media;
  // Publicidad en dos mitades: producto a la izquierda, modelo a la derecha.
  dividida?: boolean;
  // Ficha publicitaria: título, beneficios, colores y el envase detallado.
  ficha?: boolean;
};

function Marco({
  cuadro,
  texto,
  textoPos,
}: {
  cuadro: Cuadro;
  texto: string;
  textoPos: TextoPosId;
}) {
  return (
    <figure className="flex flex-col gap-1 min-w-0">
      <div
        className="relative w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm"
        style={{ aspectRatio: cuadro.proporcion, background: cuadro.fondo }}
      >
        {cuadro.dividida && cuadro.foto && (
          <div className="absolute inset-0 grid grid-cols-2 gap-1 p-1.5 bg-gray-200">
            <div className="relative rounded bg-white/80 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cuadro.foto.url} alt="" className="max-w-[88%] max-h-[80%] object-contain drop-shadow-md" />
            </div>
            <div className="relative rounded overflow-hidden" style={{ background: cuadro.fondo }}>
              <span className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold text-gray-800">
                {cuadro.persona === "hombre" ? "🧔 Modelo" : "👩 Modelo"}
              </span>
            </div>
          </div>
        )}
        {cuadro.ficha && cuadro.foto && (
          <div className="absolute inset-0 grid grid-cols-[1fr_1fr] gap-1 p-2 bg-[#f6f2f4]">
            <div className="flex flex-col gap-1 pt-1">
              <span className="h-2 w-4/5 rounded bg-violet-800" />
              <span className="h-2 w-3/5 rounded bg-pink-500" />
              <span className="h-1.5 w-full rounded bg-violet-700/80 mt-0.5" />
              {[0, 1, 2].map((i) => (
                <span key={i} className="flex items-center gap-1 mt-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-700 shrink-0" />
                  <span className="h-1.5 flex-1 rounded bg-gray-400/70" />
                </span>
              ))}
              <span className="mt-auto flex gap-1">
                <span className="h-6 flex-1 rounded-full bg-gray-800" />
                <span className="h-6 flex-1 rounded-full bg-white border border-gray-300" />
              </span>
            </div>
            <div className="relative rounded bg-white/70 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cuadro.foto.url} alt="" className="max-w-[92%] max-h-[85%] object-contain drop-shadow-md" />
            </div>
            <span className="col-span-2 h-3 rounded bg-violet-800" />
          </div>
        )}
        {cuadro.foto && !cuadro.dividida && !cuadro.ficha && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cuadro.foto.url}
            alt=""
            className="absolute inset-0 m-auto max-w-[78%] max-h-[70%] object-contain rounded-md drop-shadow-xl"
            style={cuadro.filtro ? { filter: cuadro.filtro } : undefined}
          />
        )}
        {cuadro.persona && cuadro.persona !== "ninguna" && !cuadro.dividida && !cuadro.ficha && (
          <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-gray-800">
            {cuadro.persona === "hombre" ? "🧔 Modelo IA usándolo" : "👩 Modelo IA usándolo"}
          </span>
        )}
        {cuadro.video && (
          <>
            <span className="absolute inset-0 m-auto w-11 h-11 rounded-full bg-black/55 text-white flex items-center justify-center text-lg">
              ▶
            </span>
            {cuadro.final && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cuadro.final.url}
                alt=""
                title="Final del video"
                className="absolute top-2 right-2 w-10 h-10 object-cover rounded border-2 border-white"
              />
            )}
          </>
        )}
        {texto && (
          <p
            className={`absolute left-2 right-2 text-center ${
              textoPos === "abajo" ? (cuadro.persona ? "bottom-9" : "bottom-3") : "top-3"
            }`}
          >
            <span className="inline-block rounded-md bg-black/60 px-2 py-1 font-extrabold uppercase leading-tight text-white text-xs sm:text-sm break-words">
              {texto}
            </span>
          </p>
        )}
      </div>
      <figcaption className="text-[11px] text-gray-500 text-center">{cuadro.titulo}</figcaption>
    </figure>
  );
}

export default function VistaPreviaIA({
  modo,
  fotoTipo,
  videoTipo,
  fotos,
  escena,
  persona,
  formato,
  duracion,
  texto,
  textoPos,
  nombreIA,
  etiquetaIA,
  gratis,
  videoConFotos = false,
  estilos = [],
}: {
  modo: "FOTO" | "VIDEO";
  fotoTipo: FotoTipoId;
  videoTipo: VideoTipoId;
  fotos: Media[];
  escena: EscenaId;
  persona: PersonaId;
  formato: FormatoId;
  duracion: number;
  texto: string;
  textoPos: TextoPosId;
  nombreIA: string;
  etiquetaIA: string;
  gratis: boolean;
  // Video armado en el panel con las fotos reales (sin IA).
  videoConFotos?: boolean;
  // Estilos de publicidad marcados (una foto por estilo).
  estilos?: { id: string; nombre: string }[];
}) {
  // Fondo del boceto según el estilo; si no cambia, se usa el del lugar.
  const fondoEstilo = (id: string) =>
    ({
      oferta: "linear-gradient(135deg,#f97316 0%,#ec4899 55%,#8b5cf6 100%)",
      lujo: "radial-gradient(circle at 50% 35%,#3f3320 0%,#0b0b0b 70%)",
      minimalista: "linear-gradient(180deg,#faf7f2 0%,#ece6dc 100%)",
      pop: "linear-gradient(135deg,#fde047 0%,#f472b6 50%,#22d3ee 100%)",
      editorial: "linear-gradient(180deg,#d6d3d1 0%,#78716c 100%)",
      flatlay: "repeating-linear-gradient(45deg,#f5f0e8 0 14px,#efe8dc 14px 28px)",
    })[id] || FONDOS[escena];
  const lista = estilos.length ? estilos : [{ id: "publicidad", nombre: "Campaña premium" }];
  const base = fotos[0];
  const proporcion = PROPORCION[formato];
  const cuadros: Cuadro[] = [];

  if (modo === "FOTO") {
    if (fotoTipo === "pack") {
      cuadros.push({ titulo: "Producto real", foto: base, fondo: FONDOS.estudio, proporcion });
      lista.forEach((e) =>
        cuadros.push({
          titulo: e.id === "ficha" ? e.nombre : `Con modelo · ${e.nombre}`,
          foto: base,
          fondo: fondoEstilo(e.id),
          proporcion,
          persona: persona === "ninguna" ? "mujer" : persona,
          dividida: e.id === "dividida",
          ficha: e.id === "ficha",
        })
      );
    } else if (fotoTipo === "escena") {
      lista.forEach((e) =>
        cuadros.push({
          titulo: e.nombre,
          foto: base,
          fondo: fondoEstilo(e.id),
          proporcion,
          dividida: e.id === "dividida",
          ficha: e.id === "ficha",
          persona: e.id === "dividida" ? (persona === "ninguna" ? "mujer" : persona) : undefined,
        })
      );
    } else if (fotoTipo === "catalogo") {
      cuadros.push({ titulo: "Antes", foto: base, fondo: "#f3f4f6", proporcion: "1 / 1" });
      cuadros.push({ titulo: "Después · fondo blanco", foto: base, fondo: "#ffffff", proporcion: "1 / 1" });
    } else {
      cuadros.push({ titulo: "Antes", foto: base, fondo: "#f3f4f6", proporcion });
      cuadros.push({
        titulo: "Después · mejorada",
        foto: base,
        fondo: "#f3f4f6",
        proporcion,
        filtro: "brightness(1.08) contrast(1.12) saturate(1.2)",
      });
    }
  } else if (videoConFotos) {
    cuadros.push({
      titulo: `Video ${Math.max(duracion, fotos.length * 3)} s · ${fotos.length} foto${fotos.length === 1 ? "" : "s"} con movimiento`,
      foto: base,
      fondo: "linear-gradient(180deg,#9ca3af 0%,#4b5563 100%)",
      proporcion: "9 / 16",
      video: true,
      final: fotos.length > 1 ? fotos[fotos.length - 1] : undefined,
    });
  } else {
    cuadros.push({
      titulo:
        videoTipo === "ugc"
          ? `Video ${duracion} s · UGC, alguien lo usa`
          : videoTipo === "giro"
          ? `Video ${duracion} s · giro 360°`
          : videoTipo === "colores"
          ? `Video ${duracion} s · cambio de color`
          : `Video ${duracion} s · persona usándolo`,
      foto: base,
      fondo: FONDOS[escena],
      proporcion: "9 / 16",
      video: true,
      persona: videoTipo === "persona" || videoTipo === "ugc" ? persona : undefined,
      final: fotos.length > 1 ? fotos[fotos.length - 1] : undefined,
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-navy">Vista previa · con {nombreIA}</p>
        <span
          className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${
            gratis ? "bg-green-100 text-green-800" : "bg-violet-100 text-violet-800"
          }`}
        >
          {etiquetaIA}
        </span>
      </div>
      <div
        className={`grid gap-3 ${
          cuadros.length > 2
            ? "grid-cols-2 sm:grid-cols-4"
            : cuadros.length > 1
            ? "grid-cols-2 max-w-md"
            : "grid-cols-1 max-w-[220px]"
        }`}
      >
        {cuadros.map((c) => (
          <Marco key={c.titulo} cuadro={c} texto={texto} textoPos={textoPos} />
        ))}
      </div>
      <p className="text-[11px] text-gray-500">
        {videoConFotos ? (
          "Es un boceto: el video usa tus fotos tal cual, con un acercamiento suave y un fundido entre una y otra. Lo ves completo antes de guardarlo."
        ) : (
          <>
            Es un boceto para que veas cómo se arma (formato, ambiente y texto). La imagen final la
            crea {nombreIA} y el producto queda igual al de tu foto.
          </>
        )}
        {texto && modo === "VIDEO" && !videoConFotos &&
          " Los videos con IA a veces escriben mal las letras: si pasa, poné el texto en la descripción del posteo."}
      </p>
    </div>
  );
}
