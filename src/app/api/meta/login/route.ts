import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSession } from "@/lib/auth";
import { GRAPH_VERSION, META_SCOPES, metaConfigurado, urlCallback } from "@/lib/meta";

// Manda al usuario a Facebook para autorizar al panel a publicar.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  if (!metaConfigurado()) {
    return NextResponse.redirect(new URL("/dashboard/redes?error=config", req.url));
  }

  const state = randomBytes(16).toString("hex");
  const origen = req.nextUrl.origin;

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: urlCallback(origen),
    state,
    response_type: "code",
  });
  if (process.env.META_CONFIG_ID) {
    params.set("config_id", process.env.META_CONFIG_ID);
  } else {
    params.set("scope", META_SCOPES.join(","));
  }

  const res = NextResponse.redirect(
    `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`
  );
  res.cookies.set("meta_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
