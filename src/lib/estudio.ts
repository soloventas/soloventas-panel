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
export type FotoTipoId = "pack" | "escena" | "catalogo" | "mejorar";
export type TextoPosId = "arriba" | "abajo";

// Texto que el usuario quiere escrito sobre la foto o el video (ej. "OFERTA").
export type TextoImagen = { texto?: string; textoPos?: TextoPosId };

export function limpiarTexto(t?: string) {
  return (t || "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function instruccionTexto(t: TextoImagen, video = false) {
  const texto = limpiarTexto(t.texto);
  if (!texto) return "";
  const donde = t.textoPos === "abajo" ? "bottom" : "top";
  return `Add this exact text, spelled exactly as written (it is in Spanish, keep accents and capitalization): "${texto}". Place it at the ${donde} of the ${video ? "frame, visible during the whole video" : "image"}, in a bold, clean, modern sans-serif font, large and easy to read on a phone, with strong contrast against the background, never covering the product. Do not add any other text.`;
}

// Herramientas de edición de foto. "pack" es la principal: siempre sale el
// producto real + una persona usándolo, para publicarlas juntas.
export const FOTO_TIPOS: {
  id: FotoTipoId;
  nombre: string;
  ayuda: string;
  usaEscena: boolean;
  usaPersona: boolean;
}[] = [
  {
    id: "pack",
    nombre: "Producto real + modelo",
    ayuda: "Salen 2 fotos para carrusel: el producto solo y una persona usándolo en el lugar elegido. Es la que mejor vende.",
    usaEscena: true,
    usaPersona: true,
  },
  {
    id: "escena",
    nombre: "Producto en un lugar",
    ayuda: "El producto solo, ambientado en el lugar que elijas, sin personas.",
    usaEscena: true,
    usaPersona: false,
  },
  {
    id: "catalogo",
    nombre: "Fondo blanco (catálogo / web)",
    ayuda: "Saca el fondo y deja el producto sobre blanco puro, ideal para la tienda online y MercadoLibre.",
    usaEscena: false,
    usaPersona: false,
  },
  {
    id: "mejorar",
    nombre: "Mejorar la foto",
    ayuda: "Misma foto pero con mejor luz, nitidez y colores, sin cambiar el producto ni el encuadre.",
    usaEscena: false,
    usaPersona: false,
  },
];

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

// Los modelos y costos del modo automático están en proveedores-ia.ts.

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

// Estilos de publicidad: se pueden marcar varios y sale una edición por cada uno.
export type EstiloId =
  | "publicidad"
  | "lifestyle"
  | "oferta"
  | "minimalista"
  | "lujo"
  | "pop"
  | "editorial"
  | "flatlay"
  | "detalle"
  | "dividida"
  | "ficha";

export const ESTILOS: { id: EstiloId; nombre: string; en: string }[] = [
  {
    id: "publicidad",
    nombre: "Campaña premium",
    en: "high-end commercial advertising campaign look, bold hero composition, dramatic studio-quality lighting with soft rim light, rich contrast, polished like a magazine ad",
  },
  {
    id: "lifestyle",
    nombre: "Lifestyle natural",
    en: "authentic lifestyle photography, natural candid moment, warm natural light, relatable everyday mood",
  },
  {
    id: "oferta",
    nombre: "Oferta llamativa",
    en: "eye-catching promotional look, vibrant saturated background colors, energetic dynamic composition and bold color blocking that stops the scroll in a social feed",
  },
  {
    id: "minimalista",
    nombre: "Minimalista elegante",
    en: "minimalist elegant aesthetic, lots of clean negative space, soft neutral or pastel tones, refined balanced composition",
  },
  {
    id: "lujo",
    nombre: "Lujo / fondo oscuro",
    en: "luxury dark mood, deep black background, warm golden accent lighting, sophisticated and exclusive feel",
  },
  {
    id: "pop",
    nombre: "Pop juvenil",
    en: "bold Gen Z pop style, playful bright colors, trendy social media aesthetic, fun energetic vibe",
  },
  {
    id: "editorial",
    nombre: "Revista de moda",
    en: "fashion editorial magazine style, artistic framing, cinematic color grading",
  },
  {
    id: "flatlay",
    nombre: "Vista desde arriba",
    en: "top-down flat lay composition, the product arranged neatly with a few complementary props on a styled surface",
  },
  {
    id: "detalle",
    nombre: "Detalle de cerca",
    en: "close-up detail shot that highlights texture, materials and quality, shallow depth of field",
  },
  {
    id: "dividida",
    nombre: "Producto + modelo (dividida)",
    en: "split-screen advertising layout: left half the product package in detail, right half a model using it",
  },
  {
    id: "ficha",
    nombre: "Ficha con beneficios",
    en: "infographic product ad sheet with headline, benefits, color options, sizes and the package in detail",
  },
];

export const MAX_ESTILOS = 3;

export function limpiarEstilos(lista?: unknown): EstiloId[] {
  const ids = Array.isArray(lista) ? lista : [];
  const validos = ESTILOS.map((e) => e.id).filter((id) => ids.includes(id));
  return (validos.length ? validos : ["publicidad"]).slice(0, MAX_ESTILOS) as EstiloId[];
}

function estiloEn(id?: EstiloId) {
  return (
    ESTILOS.find((e) => e.id === id)?.en ||
    "modern, aspirational, high-end lifestyle photography, realistic lighting and shadows, sharp focus on the product, shallow depth of field, vibrant but natural colors"
  );
}

// Datos del catálogo para la ficha publicitaria (no se inventa nada más).
export type DatosFicha = { descripcion?: string | null; colores?: string[]; talles?: string[] };

// "Del 34 al 45" si los talles son números; si no, la lista.
export function rangoTalles(talles: string[] = []) {
  const unicos = Array.from(new Set(talles.map((t) => t.trim()).filter(Boolean)));
  if (!unicos.length) return "";
  const nums = unicos.map(Number);
  if (unicos.length > 2 && nums.every((n) => !isNaN(n))) {
    return `Del ${Math.min(...nums)} al ${Math.max(...nums)}`;
  }
  return unicos.join(" · ");
}

// Arma los datos de la ficha con lo cargado en el catálogo.
export function fichaDe(p: {
  descripcion?: string | null;
  variantes?: { color?: { nombre: string } | null; talle?: { nombre: string } | null }[];
}): DatosFicha {
  const v = p.variantes || [];
  return {
    descripcion: p.descripcion,
    colores: Array.from(new Set(v.map((x) => x.color?.nombre || "").filter(Boolean))),
    talles: Array.from(new Set(v.map((x) => x.talle?.nombre || "").filter(Boolean))),
  };
}

type OpcionesFoto = {
  producto: string;
  ficha?: DatosFicha;
  escena: EscenaId;
  escenaPersonalizada?: string;
  persona: PersonaId;
  formato: FormatoId;
  extra?: string;
  estilo?: EstiloId;
} & TextoImagen;

// Publicidad en dos mitades: a la izquierda el producto (con su envase) bien
// detallado y a la derecha una modelo usándolo en el lugar elegido.
function promptDividida(opciones: OpcionesFoto, escena: string, formato: string) {
  const quien: PersonaId = opciones.persona === "ninguna" ? "mujer" : opciones.persona;
  return [
    "Create a professional split-screen social media advertising image for an online store, divided vertically into two halves on a clean light-gray backdrop.",
    FIDELIDAD,
    `Product: ${opciones.producto}.`,
    "LEFT HALF: a detailed, sharp e-commerce packshot of the product exactly as in the reference, including its package or bag with all its printed text, labels and logos fully legible, front-facing, softly lit, with a subtle shadow so every detail and color is clearly visible.",
    `RIGHT HALF: ${persona(quien, escena)} Scene: ${escena}. Natural, aspirational lifestyle photo with the product clearly visible while in use.`,
    "Both halves share consistent lighting and color palette and read as one polished ad.",
    `Compose it for ${formato}.`,
    instruccionTexto(opciones),
    opciones.extra?.trim() ? `Extra details: ${opciones.extra.trim()}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

// Ficha publicitaria tipo infografía: título, beneficios con íconos, colores,
// talles y el producto en su envase bien detallado. Solo usa datos reales.
function promptFicha(opciones: OpcionesFoto, formato: string) {
  const f = opciones.ficha || {};
  const descripcion = (f.descripcion || "").replace(/\s+/g, " ").trim().slice(0, 500);
  const colores = Array.from(new Set((f.colores || []).filter(Boolean))).slice(0, 4);
  const talles = rangoTalles(f.talles);
  return [
    "Create a professional Spanish-language infographic advertising sheet for an online store, in the style of a polished retail product flyer.",
    FIDELIDAD,
    `Product: ${opciones.producto}.`,
    `Layout on a soft light background with a wooden surface at the bottom: on the RIGHT, large and sharply detailed, the product exactly as in the reference, including its package with all printed text, logos and labels fully legible. On the LEFT, a bold two-color headline with the product name "${opciones.producto}".`,
    descripcion
      ? `Below the headline, three short benefit rows, each with a round flat icon, a bold uppercase title and one short line, written in Spanish and based ONLY on this description: "${descripcion}". Do not invent features, materials, guarantees or claims that are not in it.`
      : "Below the headline, leave clean space; do not invent features or claims.",
    colores.length
      ? `Under a small label "ELEGÍ LA TUYA", show the product side by side in these colors, each with its name in uppercase: ${colores.join(", ")}.`
      : "",
    talles ? `Show the size range prominently as "${talles}".` : "",
    "At the bottom, a solid colored banner with a short Spanish call to action. Use a coherent brand color palette, modern bold sans-serif typography and correct Spanish spelling. No prices.",
    `Compose it for ${formato}.`,
    instruccionTexto(opciones),
    opciones.extra?.trim() ? `Extra details: ${opciones.extra.trim()}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function promptFoto(opciones: OpcionesFoto) {
  const escena = escenaEn(opciones.escena, opciones.escenaPersonalizada || "");
  const formato =
    opciones.formato === "9:16"
      ? "a vertical 9:16 story format"
      : opciones.formato === "1:1"
      ? "a square 1:1 format"
      : "a vertical 4:5 feed format";
  if (opciones.estilo === "dividida") return promptDividida(opciones, escena, formato);
  if (opciones.estilo === "ficha") return promptFicha(opciones, formato);
  return [
    "Create a professional, eye-catching social media advertising photo for an online store that makes people want to buy the product.",
    FIDELIDAD,
    `Product: ${opciones.producto}.`,
    `Scene: ${escena}.`,
    persona(opciones.persona, escena),
    `Style: ${estiloEn(opciones.estilo)}.`,
    `Compose it for ${formato}, keeping the product clearly visible and prominent.`,
    instruccionTexto(opciones),
    opciones.extra?.trim() ? `Extra details: ${opciones.extra.trim()}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function nombreEstilo(id: EstiloId) {
  return ESTILOS.find((e) => e.id === id)?.nombre || id;
}

// Pack para carrusel: el producto real solo, en estudio, y una foto con
// modelo por cada estilo elegido.
export function promptsPackFoto(opciones: OpcionesFoto, estilos: EstiloId[] = ["publicidad"]) {
  const persona: PersonaId = opciones.persona === "ninguna" ? "mujer" : opciones.persona;
  return [
    {
      titulo: "Producto real",
      prompt: promptFoto({
        ...opciones,
        escena: "estudio",
        escenaPersonalizada: "",
        persona: "ninguna",
        estilo: estilos[0],
      }),
    },
    ...estilos.map((estilo) => ({
      titulo: estilo === "ficha" ? nombreEstilo(estilo) : `Con modelo · ${nombreEstilo(estilo)}`,
      prompt: promptFoto({ ...opciones, persona, estilo }),
      conTexto: estilo === "ficha",
    })),
  ];
}

// Arma las instrucciones según la herramienta de foto elegida. En "pack" y
// "escena" sale una foto por cada estilo de publicidad marcado.
export function promptsFotos(
  tipo: FotoTipoId,
  opciones: OpcionesFoto & { estilos?: EstiloId[] }
): { titulo: string; prompt: string; conTexto?: boolean }[] {
  const estilos = limpiarEstilos(opciones.estilos);
  const extra = opciones.extra?.trim() ? `Extra details: ${opciones.extra.trim()}` : "";
  const textoPedido = instruccionTexto(opciones);
  if (tipo === "pack") return promptsPackFoto(opciones, estilos);
  if (tipo === "escena") {
    return estilos.map((estilo) => ({
      titulo: `En el lugar · ${nombreEstilo(estilo)}`,
      prompt: promptFoto({ ...opciones, persona: "ninguna", estilo }),
      conTexto: estilo === "ficha",
    }));
  }
  if (tipo === "catalogo") {
    return [
      {
        titulo: "Fondo blanco",
        prompt: [
          "Turn this into a clean e-commerce catalog photo.",
          FIDELIDAD,
          `Product: ${opciones.producto}.`,
          "Remove the original background completely and place the product centered on a pure white (#FFFFFF) seamless background, with a soft natural shadow under it. Even, bright studio lighting, sharp focus, true-to-life colors.",
          "Square 1:1 composition with some margin around the product.",
          textoPedido,
          extra,
        ]
          .filter(Boolean)
          .join(" "),
      },
    ];
  }
  return [
    {
      titulo: "Foto mejorada",
      prompt: [
        "Enhance this product photo for online sales while keeping the same composition, framing and background.",
        FIDELIDAD,
        `Product: ${opciones.producto}.`,
        "Improve lighting and exposure, increase sharpness and detail, correct white balance, make colors vibrant but true to life, remove dust, noise and small imperfections.",
        textoPedido,
        extra,
      ]
        .filter(Boolean)
        .join(" "),
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
} & TextoImagen) {
  const escena = escenaEn(opciones.escena, opciones.escenaPersonalizada || "");
  const textoPedido = instruccionTexto(opciones, true);
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
    textoPedido,
    opciones.extra?.trim() ? `Extra details: ${opciones.extra.trim()}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
