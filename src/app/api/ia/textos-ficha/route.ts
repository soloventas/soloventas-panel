import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { credencialesCF } from "@/lib/claves-ia";
import { rangoTalles } from "@/lib/estudio";

export const maxDuration = 60;

// Textos de la "Foto detallada" escritos por la IA gratis de Cloudflare: mira la
// foto del producto (lee el envase) y arma título, frase, beneficios, cuadro de
// venta y frase final. Después el panel los dibuja sin faltas sobre la ficha.
const MODELO = "@cf/meta/llama-4-scout-17b-16e-instruct";
const PALETAS = ["violeta", "azul", "negro", "rojo", "verde"];

function corto(v: unknown, max: number) {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function sacarJSON(texto: string) {
  const a = texto.indexOf("{");
  const b = texto.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(texto.slice(a, b + 1));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { productoId, mediaId, extra } = (await req.json().catch(() => ({}))) as {
    productoId?: string;
    mediaId?: string;
    extra?: string;
  };
  if (!productoId) return NextResponse.json({ error: "Falta el producto." }, { status: 400 });

  const cred = await credencialesCF();
  if (!cred) {
    return NextResponse.json(
      { error: "Para que la IA gratis escriba los textos, conectala en el paso 1 · Conectar IAs." },
      { status: 400 }
    );
  }

  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
    select: {
      nombre: true,
      descripcion: true,
      variantes: { select: { color: { select: { nombre: true } }, talle: { select: { nombre: true } } } },
    },
  });
  if (!producto) return NextResponse.json({ error: "No encontré el producto." }, { status: 404 });
  const media = mediaId
    ? await prisma.mediaProducto.findFirst({ where: { id: mediaId, productoId }, select: { url: true } })
    : null;

  const colores = Array.from(new Set(producto.variantes.map((v) => v.color?.nombre || "").filter(Boolean)));
  const talles = rangoTalles(producto.variantes.map((v) => v.talle?.nombre || "").filter(Boolean));

  let imagen = "";
  if (media?.url) {
    try {
      const r = await fetch(media.url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 4_000_000) {
          imagen = `data:${r.headers.get("content-type") || "image/jpeg"};base64,${buf.toString("base64")}`;
        }
      }
    } catch {
      imagen = "";
    }
  }

  const pedido = [
    "Sos un redactor publicitario experto de una tienda online de Argentina (Solo Ventas).",
    imagen
      ? "Mirá la foto del producto y leé con atención todo lo que dice el envase o la etiqueta (marca, talles, materiales, características)."
      : "",
    `Producto: ${producto.nombre}.`,
    producto.descripcion ? `Descripción del vendedor: ${producto.descripcion.replace(/\s+/g, " ").slice(0, 600)}.` : "",
    colores.length ? `Colores o modelos: ${colores.join(", ")}.` : "",
    talles ? `Talles: ${talles}.` : "",
    extra?.trim() ? `Datos extra del vendedor (respetalos): ${extra.trim().slice(0, 600)}.` : "",
    "Escribí los textos de una ficha de venta para Instagram, como este ejemplo de unas plantillas:",
    '{"titulo":"Plantillas Guapa","frase":"¡Un talle para cada pie!","talles":"Del 34 al 45","beneficios":[{"titulo":"Comodidad todo el día","texto":"Acolchonadas para más confort."},{"titulo":"Calidad que se siente","texto":"Materiales resistentes y duraderos."},{"titulo":"Dos materiales","texto":"Tela piqué suave o toalla absorbente."}],"colores":"Negro, Blanco","cajaTitulo":"¿Te parece caro?","cajaTexto":"Entendemos tu preocupación. Por eso ofrecemos calidad, durabilidad y confort en cada paso.","cta":"Elegí tu talle, elegí tu confort","paleta":"violeta"}',
    "Reglas: español de Argentina con voseo (elegí, pedí), ortografía y tildes perfectas. titulo: el nombre corto del producto con su marca si se ve (máx. 4 palabras). frase: beneficio principal, corta, entre ¡! (máx. 6 palabras). talles: rango de talles o una medida clave SOLO si aparece en la foto o en los datos, si no dejalo vacío. beneficios: exactamente 3, título de 2 a 4 palabras y texto de máx. 8 palabras, basados en lo que es el producto y en lo que dice el envase; no inventes datos técnicos, garantías ni certificaciones. colores: solo los que aparecen en los datos o en la foto, separados por coma. cajaTexto: máx. 25 palabras, cercano, sobre el valor que ofrece. cta: máx. 6 palabras. paleta: la que mejor combine con el envase, una de: violeta, azul, negro, rojo, verde. Sin precios.",
    "Respondé SOLO con el JSON, sin explicaciones.",
  ]
    .filter(Boolean)
    .join("\n");

  const contenido: unknown = imagen
    ? [
        { type: "text", text: pedido },
        { type: "image_url", image_url: { url: imagen } },
      ]
    : pedido;

  let respuesta = "";
  try {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cred.cuenta.trim()}/ai/run/${MODELO}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cred.token.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: contenido }], max_tokens: 900, temperature: 0.4 }),
      cache: "no-store",
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) {
      const msg: string = data?.errors?.[0]?.message || "";
      if (r.status === 429 || /neuron|limit|quota/i.test(msg)) {
        return NextResponse.json({ error: "Se terminó el cupo gratis de hoy. Mañana se renueva." }, { status: 429 });
      }
      return NextResponse.json({ error: msg ? `La IA gratis respondió: ${msg}` : "La IA gratis no pudo escribir los textos." }, { status: 502 });
    }
    const res = data?.result?.response;
    respuesta = typeof res === "string" ? res : JSON.stringify(res ?? "");
  } catch {
    return NextResponse.json({ error: "No se pudo hablar con la IA gratis. Probá de nuevo." }, { status: 502 });
  }

  const j = sacarJSON(respuesta);
  if (!j) return NextResponse.json({ error: "La IA gratis no devolvió los textos. Probá de nuevo." }, { status: 502 });

  const beneficios = (Array.isArray(j.beneficios) ? j.beneficios : [])
    .map((b: { titulo?: unknown; texto?: unknown }) => ({ titulo: corto(b?.titulo, 30), texto: corto(b?.texto, 70) }))
    .filter((b: { titulo: string; texto: string }) => b.titulo || b.texto)
    .slice(0, 4);
  return NextResponse.json({
    titulo: corto(j.titulo, 60) || producto.nombre.slice(0, 60),
    frase: corto(j.frase, 40),
    talles: corto(j.talles, 30) || talles,
    beneficios,
    colores: corto(j.colores, 80) || colores.join(", "),
    cajaTitulo: corto(j.cajaTitulo, 40),
    cajaTexto: corto(j.cajaTexto, 220),
    cta: corto(j.cta, 50),
    paleta: PALETAS.includes(j.paleta) ? j.paleta : undefined,
  });
}
