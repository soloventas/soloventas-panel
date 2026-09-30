import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { estadoValido, volverARedes } from "@/lib/oauth";

// TikTok vuelve acá después de que el usuario autoriza al panel.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  if (req.nextUrl.searchParams.get("error")) return volverARedes(req, "error=cancelado", "tiktok_state");
  const code = req.nextUrl.searchParams.get("code");
  if (!code || !estadoValido(req, "tiktok_state")) {
    return volverARedes(req, "error=estado", "tiktok_state");
  }

  try {
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY || "",
        client_secret: process.env.TIKTOK_CLIENT_SECRET || "",
        code,
        grant_type: "authorization_code",
        redirect_uri: `${req.nextUrl.origin}/api/tiktok/callback`,
      }),
      cache: "no-store",
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok || !token.access_token) {
      throw new Error(token.error_description || token.error || "TikTok rechazó la conexión.");
    }

    // Nombre visible de la cuenta.
    let nombre = "TikTok";
    try {
      const infoRes = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",
        { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" }
      );
      const info = await infoRes.json();
      if (info?.data?.user?.display_name) nombre = info.data.user.display_name;
    } catch {
      // El nombre es un extra; la conexión igual es válida.
    }

    const datos = {
      nombre,
      externalId: token.open_id as string,
      accessToken: token.access_token as string,
      expiraEn: new Date(Date.now() + Number(token.expires_in || 86400) * 1000),
      extra: {
        refreshToken: token.refresh_token ?? null,
        refreshExpiraEn: token.refresh_expires_in
          ? new Date(Date.now() + Number(token.refresh_expires_in) * 1000).toISOString()
          : null,
        scope: token.scope ?? null,
      },
    };
    await prisma.integracionRed.upsert({
      where: { clave: "tiktok" },
      create: { clave: "tiktok", ...datos },
      update: datos,
    });

    return volverARedes(req, "ok=tiktok", "tiktok_state");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo conectar TikTok.";
    return volverARedes(req, `error=red&detalle=${encodeURIComponent(msg)}`, "tiktok_state");
  }
}
