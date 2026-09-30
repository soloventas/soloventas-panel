import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  graphGet,
  guardarPagina,
  listarPaginas,
  urlCallback,
  ErrorMeta,
} from "@/lib/meta";

// Facebook vuelve acá después de que el usuario autoriza al panel.
export async function GET(req: NextRequest) {
  const destino = (q: string) => NextResponse.redirect(new URL(`/dashboard/redes?${q}`, req.url));

  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const guardado = req.cookies.get("meta_state")?.value;

  if (req.nextUrl.searchParams.get("error")) return destino("error=cancelado");
  if (!code || !state || state !== guardado) return destino("error=estado");

  try {
    // 1) Código -> token corto del usuario
    const corto = await graphGet("oauth/access_token", {
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: urlCallback(req.nextUrl.origin),
      code,
    });

    // 2) Token corto -> token largo (~60 días). Los tokens de página que se
    //    obtienen con este token largo no vencen.
    const largo = await graphGet("oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      fb_exchange_token: corto.access_token,
    });

    const expiraEn = largo.expires_in
      ? new Date(Date.now() + Number(largo.expires_in) * 1000)
      : null;

    await prisma.integracionRed.upsert({
      where: { clave: "meta_usuario" },
      create: { clave: "meta_usuario", accessToken: largo.access_token, expiraEn },
      update: { accessToken: largo.access_token, expiraEn },
    });

    const paginas = await listarPaginas(largo.access_token);
    if (paginas.length === 0) return destino("error=sin_paginas");

    if (paginas.length === 1) {
      await guardarPagina(paginas[0]);
      const res = destino("ok=1");
      res.cookies.delete("meta_state");
      return res;
    }

    const res = destino("elegir=1");
    res.cookies.delete("meta_state");
    return res;
  } catch (e) {
    const msg = e instanceof ErrorMeta ? e.message : "No se pudo conectar con Meta.";
    return destino(`error=meta&detalle=${encodeURIComponent(msg)}`);
  }
}
