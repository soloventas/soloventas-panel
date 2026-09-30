import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { guardarPagina, listarPaginas, ErrorMeta } from "@/lib/meta";

// Lista las páginas de Facebook que administra el usuario conectado.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const usuario = await prisma.integracionRed.findUnique({ where: { clave: "meta_usuario" } });
  if (!usuario) return NextResponse.json({ error: "Primero conectá tu cuenta de Meta." }, { status: 400 });

  try {
    const paginas = await listarPaginas(usuario.accessToken);
    return NextResponse.json(
      paginas.map((p) => ({
        id: p.id,
        nombre: p.name,
        instagram: p.instagram_business_account?.username ?? null,
      }))
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof ErrorMeta ? e.message : "No se pudieron leer las páginas." },
      { status: 400 }
    );
  }
}

// Elige qué página (y su Instagram) usa el panel para publicar.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { paginaId } = await req.json().catch(() => ({ paginaId: null }));
  const usuario = await prisma.integracionRed.findUnique({ where: { clave: "meta_usuario" } });
  if (!usuario || !paginaId) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  try {
    const paginas = await listarPaginas(usuario.accessToken);
    const pagina = paginas.find((p) => p.id === paginaId);
    if (!pagina) return NextResponse.json({ error: "Página no encontrada." }, { status: 404 });
    await guardarPagina(pagina);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof ErrorMeta ? e.message : "No se pudo guardar la página." },
      { status: 400 }
    );
  }
}

// Desconecta Facebook e Instagram del panel.
export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  await prisma.integracionRed.deleteMany({
    where: { clave: { in: ["meta_usuario", "facebook", "instagram"] } },
  });
  return NextResponse.json({ ok: true });
}
