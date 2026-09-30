import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ESTILO_SOLO_VENTAS, generarTexto, iaConfigurada } from "@/lib/ia";

export const maxDuration = 60;

const GUIA_POR_RED: Record<string, string> = {
  INSTAGRAM:
    "Instagram: primera línea con gancho que frene el scroll, párrafos cortos, beneficios claros, CTA a escribir por mensaje directo o entrar a www.soloventas.com.ar, y al final entre 5 y 10 hashtags relevantes (en español, sin abusar). Máximo 1.800 caracteres.",
  FACEBOOK:
    "Facebook: foco en la oferta, los beneficios, la información útil y la confianza. CTA claro (escribinos por mensaje o entrá a www.soloventas.com.ar). Como mucho 3 hashtags. Máximo 1.500 caracteres.",
  AMBAS:
    "Un solo texto que funcione bien en Instagram y en Facebook: gancho fuerte, párrafos cortos, beneficios, CTA a mensaje directo o www.soloventas.com.ar, y al final entre 5 y 8 hashtags relevantes. Máximo 1.800 caracteres.",
};

const GUIA_POR_FORMATO: Record<string, string> = {
  FOTO: "Acompaña una foto del producto.",
  CARRUSEL: "Acompaña un carrusel de varias fotos: podés invitar a deslizar para ver más.",
  VIDEO: "Acompaña un video corto (Reel): invitá a mirarlo completo.",
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  if (!iaConfigurada()) {
    return NextResponse.json(
      { error: "Falta configurar la clave de la IA (ANTHROPIC_API_KEY) en Vercel." },
      { status: 400 }
    );
  }

  const { productoId, red, formato, incluirPrecio, indicaciones } = (await req
    .json()
    .catch(() => ({}))) as {
    productoId?: string;
    red?: string;
    formato?: string;
    incluirPrecio?: boolean;
    indicaciones?: string;
  };
  if (!productoId) return NextResponse.json({ error: "Falta el producto." }, { status: 400 });

  const p = await prisma.producto.findUnique({
    where: { id: productoId },
    include: {
      categoria: true,
      variantes: { include: { color: true, talle: true } },
    },
  });
  if (!p) return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });

  // Solo datos públicos: nunca mandamos costo, ganancia ni proveedor.
  const simbolo = p.moneda === "USD" ? "US$" : "$";
  const colores = Array.from(
    new Set(p.variantes.map((v) => v.color?.nombre).filter(Boolean))
  ) as string[];
  const talles = Array.from(
    new Set(p.variantes.map((v) => v.talle?.nombre).filter(Boolean))
  ) as string[];

  const datos = [
    `Nombre: ${p.nombre}`,
    p.descripcion ? `Descripción: ${p.descripcion}` : null,
    p.categoria ? `Categoría: ${p.categoria.nombre}` : null,
    incluirPrecio === false
      ? "Precio: no mostrar (usar \"Consultá precio y disponibilidad\")"
      : `Precio de venta: ${simbolo} ${Number(p.precio).toLocaleString("es-AR")}`,
    Number(p.compraMinima) > 1 ? `Compra mínima: ${Number(p.compraMinima)} unidades` : null,
    p.descuentoCantidadMinima && p.descuentoPorcentaje
      ? `Descuento por cantidad: ${Number(p.descuentoPorcentaje)}% llevando ${p.descuentoCantidadMinima} o más`
      : null,
    colores.length ? `Colores disponibles: ${colores.join(", ")}` : null,
    talles.length ? `Talles disponibles: ${talles.join(", ")}` : null,
    p.enOferta ? "Está en oferta: sí" : null,
    p.esNuevo ? "Es un nuevo ingreso: sí" : null,
  ]
    .filter(Boolean)
    .join("\n");

  const pedido = `Escribí el texto listo para publicar de este producto.

${GUIA_POR_RED[red || "AMBAS"] || GUIA_POR_RED.AMBAS}
${GUIA_POR_FORMATO[formato || "FOTO"] || ""}
${indicaciones?.trim() ? `Indicaciones extra del vendedor: ${indicaciones.trim()}` : ""}

Datos del producto:
${datos}

Devolvé SOLO el texto de la publicación, sin títulos, sin comillas y sin explicaciones.`;

  try {
    const texto = await generarTexto(ESTILO_SOLO_VENTAS, pedido);
    return NextResponse.json({ texto });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo generar el texto." },
      { status: 400 }
    );
  }
}
