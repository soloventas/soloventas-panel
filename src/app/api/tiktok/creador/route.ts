import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { infoCreador } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

// Cuenta de TikTok conectada y opciones que permite (TikTok exige mostrarlas
// antes de publicar).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  try {
    return NextResponse.json(await infoCreador());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo consultar TikTok.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
