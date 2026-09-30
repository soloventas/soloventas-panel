// Inicio de sesión oficial (OAuth) de YouTube y TikTok.
// El usuario pone su usuario y contraseña en la página de cada red; el panel
// solo recibe un permiso para publicar, nunca la contraseña.
//
// Necesita en Vercel:
//   YouTube: GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET
//   TikTok:  TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export function youtubeConfigurado() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function tiktokConfigurado() {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

export const TIKTOK_SCOPES = ["user.info.basic", "video.upload", "video.publish"];

// Redirige a la página de inicio de sesión de la red, guardando un "state"
// en una cookie para verificar que la vuelta es legítima.
export function redirigirConEstado(url: string, cookie: string) {
  const state = randomBytes(16).toString("hex");
  const destino = new URL(url);
  destino.searchParams.set("state", state);
  const res = NextResponse.redirect(destino.toString());
  res.cookies.set(cookie, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}

export function estadoValido(req: NextRequest, cookie: string) {
  const state = req.nextUrl.searchParams.get("state");
  const guardado = req.cookies.get(cookie)?.value;
  return Boolean(state && guardado && state === guardado);
}

export function volverARedes(req: NextRequest, query: string, cookie?: string) {
  const res = NextResponse.redirect(new URL(`/dashboard/redes?${query}`, req.url));
  if (cookie) res.cookies.delete(cookie);
  return res;
}
