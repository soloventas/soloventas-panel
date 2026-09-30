// Reglas de fotos y videos de productos. Se usan tanto en el panel
// (para avisar antes de subir) como en el servidor (para validar de verdad).

export type TipoMedia = "FOTO" | "VIDEO";

export const MAX_FOTOS = 20;
export const MAX_VIDEOS = 5;

export const MAX_FOTO_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
export const TIPOS_VIDEO = ["video/mp4", "video/quicktime", "video/webm"];

export function tipoDeArchivo(contentType: string): TipoMedia | null {
  if (TIPOS_FOTO.includes(contentType)) return "FOTO";
  if (TIPOS_VIDEO.includes(contentType)) return "VIDEO";
  return null;
}

export function maximoPorTipo(tipo: TipoMedia) {
  return tipo === "FOTO" ? MAX_FOTOS : MAX_VIDEOS;
}

export function bytesMaximosPorTipo(tipo: TipoMedia) {
  return tipo === "FOTO" ? MAX_FOTO_BYTES : MAX_VIDEO_BYTES;
}

// Solo aceptamos URLs de nuestro almacenamiento de Vercel Blob.
export function esUrlDeBlob(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}
