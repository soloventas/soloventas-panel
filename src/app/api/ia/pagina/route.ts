import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generarTexto, iaConfigurada } from "@/lib/ia";

export const maxDuration = 30;

// Lee una página web (por ejemplo, la del fabricante) y saca los detalles del
// producto para escribirlos en la foto, uno por renglón. Si la IA de textos está
// configurada, los resume; si no, toma los títulos y las listas de la página.
function limpiar(t: string) {
  return t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textoDe(html: string) {
  return limpiar(
    html
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
  )
    .slice(0, 12000);
}

function detallesSinIA(html: string) {
  const sinCodigo = html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ");
  const partes = Array.from(sinCodigo.matchAll(/<(h2|h3|h4|li)[^>]*>([\s\S]*?)<\/\1>/gi)).map((m) =>
    limpiar(m[2].replace(/<[^>]+>/g, " "))
  );
  const vistos = new Set<string>();
  return partes
    .filter((p) => p.length >= 3 && p.length <= 70)
    .filter((p) => {
      const k = p.toLowerCase();
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .slice(0, 12);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { url: pedida, producto } = (await req.json().catch(() => ({}))) as {
    url?: string;
    producto?: string;
  };
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(pedida || "") ? pedida! : `https://${pedida}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
  } catch {
    return NextResponse.json({ error: "Escribí una dirección válida, ej. www.tupagina.com.ar" }, { status: 400 });
  }

  let html = "";
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (SoloVentas panel)" },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!r.ok) throw new Error();
    html = (await r.text()).slice(0, 600000);
  } catch {
    return NextResponse.json({ error: "No se pudo abrir esa página. Revisá la dirección." }, { status: 400 });
  }

  let detalles: string[] = [];
  if (iaConfigurada()) {
    try {
      const respuesta = await generarTexto(
        "Sacás los datos de un producto de una página web para escribirlos sobre una foto publicitaria. Respondés solo con la lista, sin títulos ni comentarios.",
        `Producto: ${producto || "el producto principal de la página"}.\n\nTexto de la página:\n"""${textoDe(
          html
        )}"""\n\nSacá hasta 8 detalles cortos del producto (máximo 7 palabras cada uno), en español con ortografía perfecta, uno por renglón, sin viñetas ni números. Incluí lo más vendedor: qué bebidas o funciones tiene, materiales, capacidades y medidas. Usá solo datos que estén en el texto: no inventes nada.`
      );
      detalles = respuesta
        .split("\n")
        .map((l: string) => l.replace(/^[-*•✔✓\d.)\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 8);
    } catch {
      detalles = [];
    }
  }
  if (detalles.length === 0) detalles = detallesSinIA(html);
  if (detalles.length === 0) {
    return NextResponse.json({ error: "No encontré detalles en esa página. Escribilos a mano." }, { status: 400 });
  }
  return NextResponse.json({ detalles });
}
