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

// El texto va en franjas arriba y abajo, nunca encima del producto: la foto se
// achica lo justo para entrar completa en el medio, sobre un fondo hecho con la
// misma foto desenfocada. El tamaño final de la imagen no cambia.
export async function ponerTextoEnFoto(url: string, t: TextoFoto): Promise<Blob> {
  const img = await cargarImagen(url);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.textBaseline = "top";

  const titulo = t.titulo.trim();
  const detalles = t.detalles.map((d) => d.trim()).filter(Boolean).slice(0, 8);
  const margen = Math.round(W * 0.045);

  // Título: hasta 2 renglones, letra que se achica si hace falta.
  let tamT = Math.round(W * 0.058);
  let lineasT: string[] = [];
  while (titulo && tamT > W * 0.03) {
    ctx.font = `800 ${tamT}px ${FUENTE}`;
    lineasT = partir(ctx, titulo, W - margen * 2);
    if (lineasT.length <= 2) break;
    tamT = Math.round(tamT * 0.9);
  }
  const altoT = titulo ? lineasT.length * tamT * 1.15 + margen * 1.2 : 0;

  // Detalles: en 2 columnas si son más de 3, para ocupar poco alto.
  const columnas = detalles.length > 3 ? 2 : 1;
  const anchoCol = (W - margen * 2 - (columnas - 1) * margen) / columnas;
  let tamD = Math.round(W * 0.032);
  let renglones: string[][] = [];
  let altoD = 0;
  while (detalles.length && tamD > W * 0.02) {
    ctx.font = `600 ${tamD}px ${FUENTE}`;
    renglones = detalles.map((d) => partir(ctx, d, anchoCol - tamD * 1.4));
    const filas: number[] = [];
    renglones.forEach((r, i) => {
      const fila = Math.floor(i / columnas);
      filas[fila] = Math.max(filas[fila] || 0, r.length);
    });
    altoD = filas.reduce((a, n) => a + n * tamD * 1.25 + tamD * 0.45, 0) + margen * 1.2;
    if (altoD < H * 0.24) break;
    tamD = Math.round(tamD * 0.9);
  }
  if (!detalles.length) altoD = 0;

  const arriba = titulo && t.pos !== "abajo" ? altoT : 0;
  const abajo = altoD + (titulo && t.pos === "abajo" ? altoT : 0);

  // Fondo: la misma foto agrandada, desenfocada y oscurecida.
  const escalaF = Math.max(W / img.naturalWidth, H / img.naturalHeight) * 1.1;
  ctx.filter = "blur(28px) brightness(0.45)";
  ctx.drawImage(
    img,
    (W - img.naturalWidth * escalaF) / 2,
    (H - img.naturalHeight * escalaF) / 2,
    img.naturalWidth * escalaF,
    img.naturalHeight * escalaF
  );
  ctx.filter = "none";

  // La foto entera en el espacio del medio.
  const libreH = H - arriba - abajo;
  const escala = Math.min(W / img.naturalWidth, libreH / img.naturalHeight);
  const fw = img.naturalWidth * escala;
  const fh = img.naturalHeight * escala;
  ctx.drawImage(img, (W - fw) / 2, arriba + (libreH - fh) / 2, fw, fh);

  const ponerTitulo = (y0: number) => {
    ctx.font = `800 ${tamT}px ${FUENTE}`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    lineasT.forEach((l, i) => ctx.fillText(l, W / 2, y0 + margen * 0.6 + i * tamT * 1.15));
  };

  if (arriba) ponerTitulo(0);
  if (abajo) {
    let y = H - abajo;
    if (titulo && t.pos === "abajo") {
      ponerTitulo(y);
      y += altoT;
    }
    y += margen * 0.6;
    ctx.textAlign = "left";
    for (let i = 0; i < renglones.length; i += columnas) {
      let altoFila = 0;
      for (let k = 0; k < columnas && i + k < renglones.length; k++) {
        const partes = renglones[i + k];
        const x = margen + k * (anchoCol + margen);
        ctx.font = `700 ${tamD}px ${FUENTE}`;
        ctx.fillStyle = "#facc15";
        ctx.fillText("✔", x, y);
        ctx.font = `600 ${tamD}px ${FUENTE}`;
        ctx.fillStyle = "#fff";
        partes.forEach((l, j) => ctx.fillText(l, x + tamD * 1.4, y + j * tamD * 1.25));
        altoFila = Math.max(altoFila, partes.length * tamD * 1.25);
      }
      y += altoFila + tamD * 0.45;
    }
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
