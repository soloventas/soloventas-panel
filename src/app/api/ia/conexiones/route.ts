import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CLAVE_CF, CLAVE_FAL, cuentaCFValida } from "@/lib/claves-ia";

// Conectar las IAs una sola vez desde el panel: Cloudflare (gratis, obligatoria)
// y fal.ai (paga, opcional). Las claves nunca se devuelven al navegador.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { proveedor, cuenta, token } = await req.json().catch(() => ({}));
  if (proveedor === "fal") {
    const clave = String(token || "").trim();
    if (clave.length < 20) {
      return NextResponse.json({ error: "Pegá la clave completa de fal.ai." }, { status: 400 });
    }
    await prisma.integracionRed.upsert({
      where: { clave: CLAVE_FAL },
      create: { clave: CLAVE_FAL, nombre: "fal.ai", accessToken: clave },
      update: { accessToken: clave },
    });
    return NextResponse.json({ ok: true });
  }

  const c = String(cuenta || "").trim();
  const t = String(token || "").trim();
  if (!cuentaCFValida(c)) {
    return NextResponse.json(
      {
        error:
          "El Account ID tiene que ser un código de 32 letras y números (sin \"cfk_\"). Lo ves en la dirección de Cloudflare: dash.cloudflare.com/ESE-CÓDIGO/home",
      },
      { status: 400 }
    );
  }
  if (t.length < 20) {
    return NextResponse.json({ error: "Pegá el token completo de Cloudflare." }, { status: 400 });
  }

  // Prueba: pedimos la lista de modelos de Workers AI con esa cuenta y token.
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${c}/ai/models/search?per_page=1`,
    { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" }
  ).catch(() => null);
  if (!r || !r.ok) {
    const data = r ? await r.json().catch(() => null) : null;
    const msg: string = data?.errors?.[0]?.message || "";
    return NextResponse.json(
      {
        error:
          r && (r.status === 401 || r.status === 403)
            ? "Cloudflare no aceptó el token. Creá uno con la plantilla \"Workers AI\" y pegalo de nuevo."
            : `Cloudflare no reconoció la cuenta${msg ? ` (${msg})` : ""}. Revisá el Account ID.`,
      },
      { status: 400 }
    );
  }

  await prisma.integracionRed.upsert({
    where: { clave: CLAVE_CF },
    create: { clave: CLAVE_CF, nombre: "Cloudflare Workers AI", externalId: c, accessToken: t },
    update: { externalId: c, accessToken: t },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const fal = req.nextUrl.searchParams.get("proveedor") === "fal";
  await prisma.integracionRed.deleteMany({ where: { clave: fal ? CLAVE_FAL : CLAVE_CF } });
  return NextResponse.json({ ok: true });
}
