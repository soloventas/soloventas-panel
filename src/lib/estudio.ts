// Estudio IA: arma las instrucciones (prompts) para mejorar fotos y crear
// videos de producto. Se usa en el panel (modo gratis: el usuario copia la
// instrucción en Gemini / AI Studio) y en el servidor (modo automático).
// Los prompts van en inglés porque los modelos responden mejor así.

export type EscenaId =
  | "playa"
  | "ciudad"
  | "cafe"
  | "estudio"
  | "naturaleza"
  | "noche"
  | "personalizada";

export type PersonaId = "mujer" | "hombre" | "ninguna";
export type FormatoId = "1:1" | "4:5" | "9:16";
export type VideoTipoId = "giro" | "persona" | "colores";
export type CalidadId = "estandar" | "premium";

export const ESCENAS: { id: EscenaId; nombre: string; en: string }[] = [
  {
    id: "playa",
    nombre: "Playa / vacaciones",
    en: "a sunny tropical beach vacation setting with turquoise water, palm trees and warm golden-hour light",
  },
  {
    id: "ciudad",
    nombre: "Ciudad moderna",
    en: "a trendy modern city street with contemporary architecture and stylish storefronts, natural daylight",
  },
  {
    id: "cafe",
    nombre: "Café urbano",
    en: "a cozy modern café terrace with warm ambient light and an urban lifestyle mood",
  },
  {
    id: "estudio",
    nombre: "Estudio minimalista",
    en: "a clean minimalist studio set with a soft neutral background, subtle shadows and premium commercial lighting",
  },
  {
    id: "naturaleza",
    nombre: "Naturaleza",
    en: "a scenic outdoor nature spot, like a mountain viewpoint or a green park, with soft natural light",
  },
  {
    id: "noche",
    nombre: "Noche / rooftop",
    en: "a stylish rooftop at night with city lights softly blurred in the background",
  },
  { id: "personalizada", nombre: "A mi gusto", en: "" },
];

export const PERSONAS: { id: PersonaId; nombre: string }[] = [
  { id: "mujer", nombre: "Modelo mujer (IA)" },
  { id: "hombre", nombre: "Modelo hombre (IA)" },
  { id: "ninguna", nombre: "Solo el producto" },
];

export const FORMATOS: { id: FormatoId; nombre: string }[] = [
  { id: "4:5", nombre: "Feed vertical 4:5" },
  { id: "1:1", nombre: "Cuadrado 1:1" },
  { id: "9:16", nombre: "Historia / Reel 9:16" },
];

export const VIDEO_TIPOS: { id: VideoTipoId; nombre: string; ayuda: string }[] = [
  {
    id: "giro",
    nombre: "Giro 360°",
    ayuda: "El producto gira sobre sí mismo mostrando todos sus lados.",
  },
  {
    id: "persona",
    nombre: "Persona usándolo",
    ayuda: "Una persona artificial lo muestra a cámara y lo usa. Queda mejor si partís de una foto IA con modelo.",
  },
  {
    id: "colores",
    nombre: "Cambio de color",
    ayuda: "Elegí 2 fotos del producto en distintos colores: el video pasa de uno al otro mientras gira.",
  },
];

// Costos aproximados en US$ (fal.ai), solo para mostrar al usuario.
export const COSTO_FOTO: Record<CalidadId, number> = { estandar: 0.04, premium: 0.15 };
export const COSTO_VIDEO_SEG: Record<CalidadId, number> = { estandar: 0.084, premium: 0.112 };

export const MODELO_FOTO: Record<CalidadId, string> = {
  estandar: "fal-ai/nano-banana/edit",
  premium: "fal-ai/nano-banana-pro/edit",
};
export const MODELO_VIDEO: Record<CalidadId, string> = {
  estandar: "fal-ai/kling-video/v3/standard/image-to-video",
  premium: "fal-ai/kling-video/v3/pro/image-to-video",
};

const FIDELIDAD =
  "Use the product exactly as shown in the reference image(s): keep its shape, proportions, colors, materials, textures, logos, printed text and every detail identical. Do not redesign, recolor, resize, add or remove anything on the product.";

function persona(id: PersonaId, escena: string) {
  if (id === "ninguna") return "Show the product on its own as the hero of the shot, with no people.";
  const quien = id === "mujer" ? "adult woman" : "adult man";
  return `The product is worn or held naturally by a photorealistic AI-generated ${quien} (about 25 to 35 years old, not resembling any real or famous person), dressed in a modern casual-chic style that fits ${escena || "the scene"}. The product must be used exactly the way it is really used in everyday life, at its real size, with its real soft or rigid material and texture, in a quantity that looks natural (never stacked, enlarged or turned into a different kind of object).`;
}

function escenaEn(id: EscenaId, personalizada: string) {
  if (id === "personalizada") return personalizada.trim() || "a modern, attractive lifestyle setting";
  return ESCENAS.find((e) => e.id === id)?.en || "";
}

export function promptFoto(opciones: {
  producto: string;
  escena: EscenaId;
  escenaPersonalizada?: string;
  persona: PersonaId;
  formato: FormatoId;
  extra?: string;
}) {
  const escena = escenaEn(opciones.escena, opciones.escenaPersonalizada || "");
  const formato =
    opciones.formato === "9:16"
      ? "a vertical 9:16 story format"
      : opciones.formato === "1:1"
      ? "a square 1:1 format"
      : "a vertical 4:5 feed format";
  return [
    "Create a professional, eye-catching social media advertising photo for an online store that makes people want to buy the product.",
    FIDELIDAD,
    `Product: ${opciones.producto}.`,
    `Scene: ${escena}.`,
    persona(opciones.persona, escena),
    "Style: modern, aspirational, high-end lifestyle photography, realistic lighting and shadows, sharp focus on the product, shallow depth of field, vibrant but natural colors.",
    `Compose it for ${formato}, keeping the product clearly visible and prominent.`,
    "Output one single photo only. No added text, captions, prices, arrows, page numbers, carousel or app interface elements, watermarks or extra logos.",
    opciones.extra?.trim() ? `Extra details: ${opciones.extra.trim()}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

// Pack de 2 fotos para publicar como carrusel: 1) el producto real solo, en
// estudio; 2) el producto usado por una persona IA en el lugar elegido.
export function promptsPackFoto(opciones: {
  producto: string;
  escena: EscenaId;
  escenaPersonalizada?: string;
  persona: PersonaId;
  formato: FormatoId;
  extra?: string;
}) {
  const persona: PersonaId = opciones.persona === "ninguna" ? "mujer" : opciones.persona;
  return [
    {
      titulo: "Foto 1 · Producto real",
      prompt: promptFoto({ ...opciones, escena: "estudio", escenaPersonalizada: "", persona: "ninguna" }),
    },
    {
      titulo: "Foto 2 · Con modelo",
      prompt: promptFoto({ ...opciones, persona }),
    },
  ];
}

export function promptVideo(opciones: {
  producto: string;
  tipo: VideoTipoId;
  escena: EscenaId;
  escenaPersonalizada?: string;
  persona: PersonaId;
  extra?: string;
}) {
  const escena = escenaEn(opciones.escena, opciones.escenaPersonalizada || "");
  let base = "";
  if (opciones.tipo === "giro") {
    base = `Smooth 360-degree turntable rotation of the product, which stays centered in frame. Setting: ${escena}. Slow, elegant camera, soft premium lighting, commercial product video.`;
  } else if (opciones.tipo === "colores") {
    base = `Elegant product showcase: the product slowly rotates and smoothly transitions from the color variant in the first image to the color variant in the last image. Setting: ${escena}. Premium lighting, commercial ad style.`;
  } else {
    const quien = opciones.persona === "hombre" ? "adult man" : "adult woman";
    base = `A photorealistic AI-generated ${quien} (not a real person) in ${escena} naturally shows the product to the camera and uses it, highlighting how it looks and how it is used. Smooth cinematic camera movement, modern lifestyle advertising style.`;
  }
  return [
    base,
    `Product: ${opciones.producto}.`,
    "The product must remain exactly identical to the reference image: same shape, colors, logos and details throughout the whole video.",
    "No added text, no watermarks.",
    opciones.extra?.trim() ? `Extra details: ${opciones.extra.trim()}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
