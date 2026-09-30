import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { YOUTUBE_SCOPES, redirigirConEstado, youtubeConfigurado } from "@/lib/oauth";

// Abre el inicio de sesión de Google para conectar el canal de YouTube.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));
  if (!youtubeConfigurado()) {
    return NextResponse.redirect(new URL("/dashboard/redes?error=config_youtube", req.url));
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${req.nextUrl.origin}/api/youtube/callback`,
    response_type: "code",
    scope: YOUTUBE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return redirigirConEstado(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    "youtube_state"
  );
}
