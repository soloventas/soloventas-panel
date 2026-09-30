import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// Desconecta una red del panel. Facebook arrastra a Instagram, porque el
// Instagram profesional publica a través de la página de Facebook.
const CLAVES: Record<string, string[]> = {
  instagram: ["instagram"],
  facebook: ["meta_usuario", "facebook", "instagram"],
  youtube: ["youtube"],
  tiktok: ["tiktok"],
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { red } = await req.json().catch(() => ({ red: null }));
  const claves = CLAVES[red as string];
  if (!claves) return NextResponse.json({ error: "Red inválida." }, { status: 400 });

  await prisma.integracionRed.deleteMany({ where: { clave: { in: claves } } });
  return NextResponse.json({ ok: true });
}
