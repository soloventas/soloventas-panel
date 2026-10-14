import { prisma } from "./prisma";

// Claves de las IA que se usan dentro del panel. Se cargan una sola vez desde
// "Conectar IAs" (quedan guardadas en la base) o, si no, desde Vercel.
// - Cloudflare (fotos gratis): externalId = Account ID, accessToken = token.
// - fal.ai (videos y fotos pagas por uso): accessToken = clave.

export const CLAVE_CF = "ia-cloudflare";
export const CLAVE_FAL = "ia-fal";

export async function credencialesCF(): Promise<{ cuenta: string; token: string } | null> {
  const fila = await prisma.integracionRed
    .findUnique({ where: { clave: CLAVE_CF }, select: { externalId: true, accessToken: true } })
    .catch(() => null);
  const cuenta = fila?.externalId || process.env.CF_ACCOUNT_ID || "";
  const token = fila?.accessToken || process.env.CF_API_TOKEN || "";
  return cuenta && token ? { cuenta, token } : null;
}

export async function claveFal(): Promise<string | null> {
  const fila = await prisma.integracionRed
    .findUnique({ where: { clave: CLAVE_FAL }, select: { accessToken: true } })
    .catch(() => null);
  return fila?.accessToken || process.env.FAL_KEY || null;
}

// El Account ID de Cloudflare son 32 letras y números (0-9, a-f).
export function cuentaCFValida(cuenta: string) {
  return /^[0-9a-f]{32}$/i.test(cuenta.trim());
}
