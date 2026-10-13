// Catálogo de IAs para el Estudio IA.
// - HERRAMIENTAS_GRATIS: webs con plan gratis (o créditos gratis). El panel
//   arma la instrucción, el usuario la copia y abre la web elegida.
// - MODELOS_AUTO: modelos pagos que el panel usa solo, vía fal.ai (FAL_KEY).
//   Cada uno arma su propio pedido porque cada modelo usa otros nombres de
//   parámetros.

import type { CalidadId, FormatoId } from "./estudio";

export type ModoIA = "FOTO" | "VIDEO";

export type HerramientaGratis = {
  id: string;
  nombre: string;
  empresa: string;
  url: string;
  modos: ModoIA[];
  plan: string; // cómo es lo gratis, en pocas palabras
  pasos: Record<ModoIA, string>;
};

export const HERRAMIENTAS_GRATIS: HerramientaGratis[] = [
  {
    id: "gemini",
    nombre: "Gemini",
    empresa: "Google",
    url: "https://gemini.google.com/app",
    modos: ["FOTO", "VIDEO"],
    plan: "Gratis con tu cuenta de Google (con límite diario)",
    pasos: {
      FOTO: "Entrá con tu cuenta de Google, adjuntá la foto con el botón + y pegá la instrucción.",
      VIDEO: "Entrá con tu cuenta de Google, elegí la opción de video (Veo), adjuntá la foto y pegá la instrucción.",
    },
  },
  {
    id: "aistudio",
    nombre: "Google AI Studio",
    empresa: "Google",
    url: "https://aistudio.google.com/",
    modos: ["FOTO", "VIDEO"],
    plan: "Gratis con tu cuenta de Google (con límite)",
    pasos: {
      FOTO: "Elegí un modelo de imagen (Nano Banana), adjuntá la foto y pegá la instrucción.",
      VIDEO: "Elegí generar video (Veo), adjuntá la foto y pegá la instrucción.",
    },
  },
  {
    id: "meta",
    nombre: "Meta AI",
    empresa: "Meta",
    url: "https://www.meta.ai/",
    modos: ["FOTO", "VIDEO"],
    plan: "Gratis con tu cuenta de Facebook o Instagram",
    pasos: {
      FOTO: "Adjuntá la foto, pegá la instrucción y pedile que la edite.",
      VIDEO: "Adjuntá la foto, pegá la instrucción y usá la opción de animar / crear video.",
    },
  },
  {
    id: "chatgpt",
    nombre: "ChatGPT",
    empresa: "OpenAI",
    url: "https://chatgpt.com/",
    modos: ["FOTO"],
    plan: "Plan gratis con pocas imágenes por día",
    pasos: {
      FOTO: "Adjuntá la foto con el clip, pegá la instrucción y pedile la imagen.",
      VIDEO: "",
    },
  },
  {
    id: "copilot",
    nombre: "Microsoft Copilot",
    empresa: "Microsoft",
    url: "https://copilot.microsoft.com/",
    modos: ["FOTO"],
    plan: "Gratis con cuenta de Microsoft (con límite)",
    pasos: {
      FOTO: "Adjuntá la foto, pegá la instrucción y pedile la imagen.",
      VIDEO: "",
    },
  },
  {
    id: "higgsfield",
    nombre: "Higgsfield",
    empresa: "Higgsfield AI",
    url: "https://higgsfield.ai/",
    modos: ["FOTO", "VIDEO"],
    plan: "Créditos gratis limitados; después es pago",
    pasos: {
      FOTO: "Elegí crear imagen, subí la foto del producto y pegá la instrucción.",
      VIDEO: "Elegí crear video desde imagen, subí la foto y pegá la instrucción.",
    },
  },
  {
    id: "kling",
    nombre: "Kling AI",
    empresa: "Kuaishou",
    url: "https://app.klingai.com/",
    modos: ["FOTO", "VIDEO"],
    plan: "Créditos gratis diarios (con límite)",
    pasos: {
      FOTO: "Elegí imagen, subí la foto como referencia y pegá la instrucción.",
      VIDEO: "Elegí video desde imagen (Image to Video), subí la foto y pegá la instrucción.",
    },
  },
  {
    id: "hailuo",
    nombre: "Hailuo AI",
    empresa: "MiniMax",
    url: "https://hailuoai.video/",
    modos: ["VIDEO"],
    plan: "Créditos gratis al registrarte (con límite)",
    pasos: {
      FOTO: "",
      VIDEO: "Elegí video desde imagen, subí la foto y pegá la instrucción.",
    },
  },
  {
    id: "leonardo",
    nombre: "Leonardo AI",
    empresa: "Canva",
    url: "https://app.leonardo.ai/",
    modos: ["FOTO", "VIDEO"],
    plan: "Créditos gratis diarios (con límite)",
    pasos: {
      FOTO: "Entrá a crear imagen, subí la foto como referencia y pegá la instrucción.",
      VIDEO: "Entrá a crear video desde imagen, subí la foto y pegá la instrucción.",
    },
  },
  {
    id: "buzzy",
    nombre: "Buzzy",
    empresa: "Creati",
    url: "https://buzzy.now/",
    modos: ["VIDEO"],
    plan: "Editor de video con IA; mirá en su web si tenés prueba gratis",
    pasos: {
      FOTO: "",
      VIDEO: "Subí la foto o un video del producto y pegá la instrucción en el chat del editor.",
    },
  },
];

export function herramientasPara(modo: ModoIA) {
  return HERRAMIENTAS_GRATIS.filter((h) => h.modos.includes(modo));
}

// --- Modo automático (pago, vía fal.ai) ---

export type DatosPedido = {
  prompt: string;
  urls: string[]; // fotos de base, en orden
  formato: FormatoId;
  duracion: 5 | 10;
};

export type ModeloAuto = {
  id: string;
  nombre: string;
  empresa: string;
  modo: ModoIA;
  endpoint: string; // modelo en fal.ai
  // US$ aproximados: por foto, o por segundo de video. null = ver en fal.ai.
  costo: number | null;
  nota: string;
  // Si el modelo usa la foto final (cambio de color).
  usaFotoFinal?: boolean;
  armar: (d: DatosPedido) => Record<string, unknown>;
};

const NEGATIVO =
  "blur, distortion, deformed product, changed logo, extra text, watermark, low quality";

const fotoNanoBanana = (d: DatosPedido) => ({
  prompt: d.prompt,
  image_urls: d.urls.slice(0, 4),
  num_images: 1,
  aspect_ratio: d.formato,
  output_format: "jpeg",
});

const videoKling = (d: DatosPedido) => {
  const input: Record<string, unknown> = {
    prompt: d.prompt,
    start_image_url: d.urls[0],
    duration: d.duracion,
    generate_audio: false,
    negative_prompt: NEGATIVO,
  };
  if (d.urls.length > 1) input.end_image_url = d.urls[d.urls.length - 1];
  return input;
};

export const MODELOS_AUTO: ModeloAuto[] = [
  {
    id: "nano-banana",
    nombre: "Nano Banana",
    empresa: "Google Gemini",
    modo: "FOTO",
    endpoint: "fal-ai/nano-banana/edit",
    costo: 0.04,
    nota: "La más económica. Muy buena para mantener el producto igual.",
    armar: fotoNanoBanana,
  },
  {
    id: "nano-banana-2",
    nombre: "Nano Banana 2",
    empresa: "Google Gemini",
    modo: "FOTO",
    endpoint: "fal-ai/nano-banana-2/edit",
    costo: 0.08,
    nota: "Versión nueva de Gemini, más detalle y mejor luz.",
    armar: fotoNanoBanana,
  },
  {
    id: "nano-banana-pro",
    nombre: "Nano Banana Pro",
    empresa: "Google Gemini",
    modo: "FOTO",
    endpoint: "fal-ai/nano-banana-pro/edit",
    costo: 0.15,
    nota: "La de mejor calidad de Gemini.",
    armar: fotoNanoBanana,
  },
  {
    id: "seedream-4",
    nombre: "Seedream 4",
    empresa: "ByteDance (TikTok)",
    modo: "FOTO",
    endpoint: "fal-ai/bytedance/seedream/v4/edit",
    costo: null,
    nota: "Alternativa a Gemini, estilo más publicitario.",
    armar: (d) => ({
      prompt: d.prompt,
      image_urls: d.urls.slice(0, 4),
      num_images: 1,
      image_size:
        d.formato === "1:1" ? "square_hd" : d.formato === "9:16" ? "portrait_16_9" : "portrait_4_3",
    }),
  },
  {
    id: "kling-estandar",
    nombre: "Kling 3 Estándar",
    empresa: "Kuaishou",
    modo: "VIDEO",
    endpoint: "fal-ai/kling-video/v3/standard/image-to-video",
    costo: 0.084,
    nota: "Buena calidad a buen precio. Acepta foto de inicio y de final.",
    usaFotoFinal: true,
    armar: videoKling,
  },
  {
    id: "kling-pro",
    nombre: "Kling 3 Pro",
    empresa: "Kuaishou",
    modo: "VIDEO",
    endpoint: "fal-ai/kling-video/v3/pro/image-to-video",
    costo: 0.112,
    nota: "Más nitidez y movimientos más suaves.",
    usaFotoFinal: true,
    armar: videoKling,
  },
  {
    id: "seedance-2-fast",
    nombre: "Seedance 2.0 Fast",
    empresa: "ByteDance (TikTok)",
    modo: "VIDEO",
    endpoint: "bytedance/seedance-2.0/fast/image-to-video",
    costo: null,
    nota: "Rápido y económico, pensado para videos verticales de redes.",
    usaFotoFinal: true,
    armar: (d) => {
      const input: Record<string, unknown> = {
        prompt: d.prompt,
        image_url: d.urls[0],
        duration: String(d.duracion),
        resolution: "720p",
        aspect_ratio: "9:16",
        generate_audio: false,
      };
      if (d.urls.length > 1) input.end_image_url = d.urls[d.urls.length - 1];
      return input;
    },
  },
];

export const MODELO_AUTO_DEFECTO: Record<ModoIA, string> = {
  FOTO: "nano-banana",
  VIDEO: "kling-estandar",
};

export function modelosPara(modo: ModoIA) {
  return MODELOS_AUTO.filter((m) => m.modo === modo);
}

export function buscarModelo(modo: ModoIA, id?: string, calidad?: CalidadId) {
  const lista = modelosPara(modo);
  const elegido = lista.find((m) => m.id === id);
  if (elegido) return elegido;
  // Compatibilidad con el selector viejo de calidad (estándar / premium).
  if (calidad === "premium") return lista.find((m) => m.id === (modo === "FOTO" ? "nano-banana-pro" : "kling-pro"))!;
  return lista.find((m) => m.id === MODELO_AUTO_DEFECTO[modo])!;
}

export function costoTexto(m: ModeloAuto, modo: ModoIA, duracion: number) {
  if (m.costo === null) return "precio según fal.ai";
  const total = modo === "FOTO" ? m.costo * 2 : m.costo * duracion;
  return `≈ US$ ${total.toFixed(2)}`;
}
