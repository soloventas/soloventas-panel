import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { estadoValido, volverARedes } from "@/lib/oauth";

// Google vuelve acá después de que el usuario autoriza al panel.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  if (req.nextUrl.searchParams.get("error")) return volverARedes(req, "error=cancelado", "youtube_state");
  const code = req.nextUrl.searchParams.get("code");
  if (!code || !estadoValido(req, "youtube_state")) {
    return volverARedes(req, "error=estado", "youtube_state");
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: `${req.nextUrl.origin}/api/youtube/callback`,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok || !token.access_token) {
      throw new Error(token.error_description || token.error || "Google rechazó la conexión.");
    }

    // Nombre del canal para mostrarlo en el panel.
    const canalRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store" }
    );
    const canal = await canalRes.json();
    const item = canal.items?.[0];
    if (!item) throw new Error("La cuenta no tiene un canal de YouTube.");

    const anterior = await prisma.integracionRed.findUnique({ where: { clave: "youtube" } });
    const refresh =
      token.refresh_token ||
      ((anterior?.extra as { refreshToken?: string } | null)?.refreshToken ?? null);

    const datos = {
      nombre: item.snippet?.title ?? "YouTube",
      externalId: item.id as string,
      accessToken: token.access_token as string,
      expiraEn: new Date(Date.now() + Number(token.expires_in || 3600) * 1000),
      extra: { refreshToken: refresh },
    };
    await prisma.integracionRed.upsert({
      where: { clave: "youtube" },
      create: { clave: "youtube", ...datos },
      update: datos,
    });

    return volverARedes(req, "ok=youtube", "youtube_state");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo conectar YouTube.";
    return volverARedes(req, `error=red&detalle=${encodeURIComponent(msg)}`, "youtube_state");
  }
}
