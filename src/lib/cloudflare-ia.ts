// IA gratis dentro del panel: Cloudflare Workers AI regala 10.000 "neuronas"
// por día. Con FLUX.2 Klein eso alcanza para decenas de fotos diarias sin pagar.
// Necesita CF_ACCOUNT_ID y CF_API_TOKEN (permiso "Workers AI") en Vercel.

import type { FormatoId } from "./estudio";

export function cfConfigurado() {
  return Boolean(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN);
}

export type ModeloGratis = {
  id: string;
  nombre: string;
  empresa: string;
  modelo: string; // id en Workers AI
  porDia: string; // cuántas fotos gratis por día, aprox.
  nota: string;
  recomendado?: boolean;
};

export const MODELOS_GRATIS: ModeloGratis[] = [
  {
    id: "flux-klein-4b",
    nombre: "FLUX.2 Klein",
    empresa: "Black Forest Labs · vía Cloudflare",
    modelo: "@cf/black-forest-labs/flux-2-klein-4b",
    porDia: "≈ 50 fotos gratis por día",
    nota: "Rápida y gratis todos los días. Usa tus fotos como referencia del producto.",
    recomendado: true,
  },
  {
    id: "flux-klein-9b",
    nombre: "FLUX.2 Klein 9B",
    empresa: "Black Forest Labs · vía Cloudflare",
    modelo: "@cf/black-forest-labs/flux-2-klein-9b",
    porDia: "≈ 5 fotos gratis por día",
    nota: "Más detalle y mejor fidelidad del producto, pero rinde menos por día.",
  },
];

export function buscarModeloGratis(id?: string) {
  return MODELOS_GRATIS.find((m) => m.id === id) || MODELOS_GRATIS[0];
}

export function medidas(formato: FormatoId) {
  if (formato === "1:1") return { width: 1024, height: 1024 };
  if (formato === "9:16") return { width: 1080, height: 1920 };
  return { width: 1024, height: 1280 };
}

// Genera una foto con las fotos de base como referencia (cada una < 512 px).
export async function generarFotoGratis(
  modelo: ModeloGratis,
  prompt: string,
  referencias: Blob[],
  formato: FormatoId
): Promise<{ datos: ArrayBuffer; contentType: string }> {
  const { width, height } = medidas(formato);
  const form = new FormData();
  form.append("prompt", prompt.slice(0, 2000));
  form.append("width", String(width));
  form.append("height", String(height));
  referencias.slice(0, 4).forEach((r, i) => form.append(`input_image_${i}`, r, `ref${i}.jpg`));

  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${modelo.modelo}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}` },
      body: form,
      cache: "no-store",
    }
  );

  const tipo = r.headers.get("content-type") || "";
  if (r.ok && tipo.startsWith("image/")) {
    return { datos: await r.arrayBuffer(), contentType: tipo };
  }
  const data = await r.json().catch(() => null);
  if (!r.ok || !data?.result?.image) {
    const msg: string = data?.errors?.[0]?.message || "";
    if (r.status === 429 || /neuron|limit|quota/i.test(msg)) {
      throw new Error("Se terminó el cupo gratis de hoy. Mañana se renueva, o usá otra IA.");
    }
    if (r.status === 401 || r.status === 403) {
      throw new Error("La clave de Cloudflare no es válida. Revisá CF_API_TOKEN en Vercel.");
    }
    throw new Error(msg ? `La IA gratis respondió: ${msg}` : "La IA gratis no pudo generar la foto.");
  }
  const buf = Buffer.from(data.result.image as string, "base64");
  const contentType = buf[0] === 0x89 ? "image/png" : "image/jpeg";
  return {
    datos: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
    contentType,
  };
}
