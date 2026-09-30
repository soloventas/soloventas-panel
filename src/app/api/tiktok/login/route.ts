import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { TIKTOK_SCOPES, redirigirConEstado, tiktokConfigurado } from "@/lib/oauth";

// Abre el inicio de sesión de TikTok para conectar la cuenta.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  if (!tiktokConfigurado()) {
    return NextResponse.redirect(new URL("/dashboard/redes?error=config_tiktok", req.url));
  }

  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    response_type: "code",
    scope: TIKTOK_SCOPES.join(","),
    redirect_uri: `${req.nextUrl.origin}/api/tiktok/callback`,
  });
  return redirigirConEstado(
    `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`,
    "tiktok_state"
  );
}
