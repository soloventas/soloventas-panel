// Escribe el título y los detalles sobre una foto, en el navegador.
// Las IA de imagen escriben con faltas de ortografía, así que el texto nunca
// se le pide a la IA: lo dibuja el panel letra por letra, tal cual lo escribiste.

import { cargarImagen } from "./video-navegador";

export type TextoFoto = {
  titulo: string;
  pos: "arriba" | "abajo";
  // Un detalle por renglón (se muestran con ✔).
  detalles: string[];
};

export function hayTexto(t: TextoFoto) {
  return Boolean(t.titulo.trim() || t.detalles.some((d) => d.trim()));
}

// Separa la descripción del catálogo en renglones cortos para usar de detalles.
export function detallesDeDescripcion(descripcion: string, maximo = 6) {
  return descripcion
    .split(/\r?\n|•|·|;|(?<=\.)\s+/)
    .map((d) => d.replace(/^[-*✔✓\s]+/, "").replace(/\.$/, "").trim())
    .filter((d) => d.length > 2)
    .slice(0, maximo);
}

const FUENTE = '"Inter", "Helvetica Neue", Arial, sans-serif';

function partir(ctx: CanvasRenderingContext2D, texto: string, ancho: number) {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width <= ancho || !actual) actual = prueba;
    else {
      lineas.push(actual);
      actual = p;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

// Achica la letra hasta que el título entre en 3 renglones como máximo.
function medirTitulo(ctx: CanvasRenderingContext2D, titulo: string, W: number) {
  let tam = Math.round(W * 0.075);
  let lineas: string[] = [];
  while (tam > W * 0.035) {
    ctx.font = `800 ${tam}px ${FUENTE}`;
    lineas = partir(ctx, titulo, W * 0.88);
    if (lineas.length <= 3) break;
    tam = Math.round(tam * 0.9);
  }
  return { tam, lineas };
}

function escribir(ctx: CanvasRenderingContext2D, linea: string, x: number, y: number, tam: number) {
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2, tam * 0.12);
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(linea, x, y);
  ctx.fillStyle = "#fff";
  ctx.fillText(linea, x, y);
}

export async function ponerTextoEnFoto(url: string, t: TextoFoto): Promise<Blob> {
  const img = await cargarImagen(url);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, W, H);
  ctx.textBaseline = "top";

  const titulo = t.titulo.trim();
  const detalles = t.detalles.map((d) => d.trim()).filter(Boolean).slice(0, 8);
  const margen = Math.round(W * 0.06);
  const { tam: tamT, lineas: lineasT } = titulo ? medirTitulo(ctx, titulo, W) : { tam: 0, lineas: [] };
  const altoT = lineasT.length * tamT * 1.15;

  // Detalles: renglones con ✔, en un panel oscuro abajo.
  let tamD = Math.round(W * 0.042);
  let renglones: string[][] = [];
  while (detalles.length && tamD > W * 0.025) {
    ctx.font = `600 ${tamD}px ${FUENTE}`;
    renglones = detalles.map((d) => partir(ctx, d, W - margen * 2 - tamD * 1.4));
    const total = renglones.flat().length * tamD * 1.3 + detalles.length * tamD * 0.35;
    if (total < H * 0.38) break;
    tamD = Math.round(tamD * 0.9);
  }
  const altoD = detalles.length
    ? renglones.flat().length * tamD * 1.3 + detalles.length * tamD * 0.35
    : 0;

  const tituloAbajo = Boolean(titulo) && t.pos === "abajo";
  const altoAbajo = altoD + (tituloAbajo ? altoT + tamD * 0.6 : 0);

  if (titulo && !tituloAbajo) {
    const alto = altoT + margen * 1.6;
    const g = ctx.createLinearGradient(0, 0, 0, alto);
    g.addColorStop(0, "rgba(0,0,0,0.6)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, alto);
    ctx.font = `800 ${tamT}px ${FUENTE}`;
    ctx.textAlign = "center";
    lineasT.forEach((l, i) => escribir(ctx, l, W / 2, margen * 0.8 + i * tamT * 1.15, tamT));
  }

  if (altoAbajo > 0) {
    const alto = altoAbajo + margen * 2;
    const g = ctx.createLinearGradient(0, H - alto, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.25, "rgba(0,0,0,0.65)");
    g.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = g;
    ctx.fillRect(0, H - alto, W, alto);
    let y = H - margen - altoAbajo;
    if (tituloAbajo) {
      ctx.font = `800 ${tamT}px ${FUENTE}`;
      ctx.textAlign = detalles.length ? "left" : "center";
      const x = detalles.length ? margen : W / 2;
      lineasT.forEach((l, i) => escribir(ctx, l, x, y + i * tamT * 1.15, tamT));
      y += altoT + tamD * 0.6;
    }
    ctx.textAlign = "left";
    renglones.forEach((partes) => {
      ctx.font = `700 ${tamD}px ${FUENTE}`;
      ctx.fillStyle = "#facc15";
      ctx.fillText("✔", margen, y);
      ctx.font = `600 ${tamD}px ${FUENTE}`;
      partes.forEach((l, i) => {
        ctx.fillStyle = "#fff";
        ctx.fillText(l, margen + tamD * 1.4, y + i * tamD * 1.3);
      });
      y += partes.length * tamD * 1.3 + tamD * 0.35;
    });
  }

  return new Promise((ok, mal) =>
    c.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo escribir el texto en la foto."))), "image/jpeg", 0.92)
  );
}

// Junta hasta 4 fotos reales en una sola imagen (collage), sin IA.
// 1 foto: entera · 2: una arriba de la otra · 3: una grande arriba y dos abajo · 4: grilla 2x2.
export async function armarCollage(
  urls: string[],
  formato: "4:5" | "1:1" | "9:16" = "4:5"
): Promise<Blob> {
  const W = 1080;
  const H = formato === "1:1" ? 1080 : formato === "9:16" ? 1920 : 1350;
  const imgs = await Promise.all(urls.slice(0, 4).map((u) => cargarImagen(u)));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  const g = 10; // separación blanca entre fotos
  const n = imgs.length;
  const celdas: [number, number, number, number][] =
    n === 1
      ? [[0, 0, W, H]]
      : n === 2
      ? [
          [0, 0, W, (H - g) / 2],
          [0, (H + g) / 2, W, (H - g) / 2],
        ]
      : n === 3
      ? [
          [0, 0, W, H * 0.58 - g / 2],
          [0, H * 0.58 + g / 2, (W - g) / 2, H * 0.42 - g / 2],
          [(W + g) / 2, H * 0.58 + g / 2, (W - g) / 2, H * 0.42 - g / 2],
        ]
      : [
          [0, 0, (W - g) / 2, (H - g) / 2],
          [(W + g) / 2, 0, (W - g) / 2, (H - g) / 2],
          [0, (H + g) / 2, (W - g) / 2, (H - g) / 2],
          [(W + g) / 2, (H + g) / 2, (W - g) / 2, (H - g) / 2],
        ];
  imgs.forEach((img, i) => {
    const [x, y, w, h] = celdas[i];
    // Recorte tipo "cover": llena la celda sin deformar la foto.
    const escala = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / escala;
    const sh = h / escala;
    const sx = (img.naturalWidth - sw) / 2;
    const sy = (img.naturalHeight - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  });
  return new Promise((ok, mal) =>
    c.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo armar el collage."))), "image/jpeg", 0.92)
  );
}
