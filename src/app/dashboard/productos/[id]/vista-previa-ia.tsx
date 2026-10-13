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
        {cuadro.foto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cuadro.foto.url}
            alt=""
            className="absolute inset-0 m-auto max-w-[78%] max-h-[70%] object-contain rounded-md drop-shadow-xl"
            style={cuadro.filtro ? { filter: cuadro.filtro } : undefined}
          />
        )}
        {cuadro.persona && cuadro.persona !== "ninguna" && (
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
                className="absolute bottom-2 right-2 w-10 h-10 object-cover rounded border-2 border-white"
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
}) {
  const base = fotos[0];
  const proporcion = PROPORCION[formato];
  const cuadros: Cuadro[] = [];

  if (modo === "FOTO") {
    if (fotoTipo === "pack") {
      cuadros.push({ titulo: "Foto 1 · producto real", foto: base, fondo: FONDOS.estudio, proporcion });
      cuadros.push({
        titulo: "Foto 2 · con modelo",
        foto: base,
        fondo: FONDOS[escena],
        proporcion,
        persona: persona === "ninguna" ? "mujer" : persona,
      });
    } else if (fotoTipo === "escena") {
      cuadros.push({ titulo: "Producto en el lugar", foto: base, fondo: FONDOS[escena], proporcion });
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
  } else {
    cuadros.push({
      titulo:
        videoTipo === "giro"
          ? `Video ${duracion} s · giro 360°`
          : videoTipo === "colores"
          ? `Video ${duracion} s · cambio de color`
          : `Video ${duracion} s · persona usándolo`,
      foto: base,
      fondo: FONDOS[escena],
      proporcion: "9 / 16",
      video: true,
      persona: videoTipo === "persona" ? persona : undefined,
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
          cuadros.length > 1 ? "grid-cols-2 max-w-md" : "grid-cols-1 max-w-[220px]"
        }`}
      >
        {cuadros.map((c) => (
          <Marco key={c.titulo} cuadro={c} texto={texto} textoPos={textoPos} />
        ))}
      </div>
      <p className="text-[11px] text-gray-500">
        Es un boceto para que veas cómo se arma (formato, ambiente y texto). La imagen final la crea{" "}
        {nombreIA} y el producto queda igual al de tu foto.
        {texto && modo === "VIDEO" &&
          " Los videos con IA a veces escriben mal las letras: si pasa, poné el texto en la descripción del posteo."}
      </p>
    </div>
  );
}
