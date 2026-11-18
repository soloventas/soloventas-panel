// "Foto detallada": una ficha publicitaria armada en el navegador, como un
// flyer de producto (título, talles, beneficios, colores y un cuadro de venta).
// Todo el texto lo escribe el panel tal cual lo cargaste: sin faltas y sin inventar.

import { cargarImagen } from "./video-navegador";

export type Beneficio = { titulo: string; texto: string };

export type DatosFichaFoto = {
  titulo: string;
  frase: string; // destacado en una cinta, ej. "¡Un talle para cada pie!"
  talles: string; // ej. "Del 34 al 45"
  beneficios: Beneficio[];
  colores: string; // nombres separados por coma, ej. "Negro, Blanco"
  cajaTitulo: string; // cuadro de venta opcional, ej. "¿Te parece caro?"
  cajaTexto: string;
  cta: string; // cinta de abajo, ej. "Elegí tu talle, elegí tu confort"
  paleta: PaletaId;
};

export type PaletaId = "violeta" | "azul" | "negro" | "rojo" | "verde";

export const PALETAS: { id: PaletaId; nombre: string; fuerte: string; acento: string; fondo: string }[] = [
  { id: "violeta", nombre: "Violeta y rosa", fuerte: "#3b1d6e", acento: "#db2777", fondo: "#f6f1ee" },
  { id: "azul", nombre: "Azul", fuerte: "#13285c", acento: "#0ea5e9", fondo: "#eef3f8" },
  { id: "negro", nombre: "Negro y dorado", fuerte: "#111111", acento: "#c9a227", fondo: "#f4f1ea" },
  { id: "rojo", nombre: "Rojo", fuerte: "#3f0d12", acento: "#e11d48", fondo: "#f8f0ef" },
  { id: "verde", nombre: "Verde", fuerte: "#0f3d2e", acento: "#16a34a", fondo: "#eff6f1" },
];

const ICONOS = ["✓", "★", "◆", "♥"];

const COLORES: Record<string, string> = {
  negro: "#111", blanco: "#fff", gris: "#9ca3af", rojo: "#dc2626", azul: "#2563eb", celeste: "#7dd3fc",
  verde: "#16a34a", amarillo: "#facc15", naranja: "#f97316", rosa: "#f472b6", fucsia: "#db2777",
  violeta: "#7c3aed", lila: "#c4b5fd", marron: "#7c4a21", "marrón": "#7c4a21", beige: "#e8dcc4",
  crema: "#f5ecd7", bordo: "#7f1d1d", "bordó": "#7f1d1d", dorado: "#c9a227", plateado: "#cbd5e1",
};

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

function redondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Dibuja la foto entera dentro de un recuadro (sin recortar el producto).
function fotoEn(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const e = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const fw = img.naturalWidth * e;
  const fh = img.naturalHeight * e;
  ctx.drawImage(img, x + (w - fw) / 2, y + (h - fh) / 2, fw, fh);
}

// Escribe varios renglones y devuelve dónde terminó.
function renglones(
  ctx: CanvasRenderingContext2D,
  texto: string,
  x: number,
  y: number,
  ancho: number,
  tam: number,
  peso: number,
  color: string,
  max = 4
) {
  ctx.font = `${peso} ${tam}px ${FUENTE}`;
  ctx.fillStyle = color;
  const lineas = partir(ctx, texto, ancho).slice(0, max);
  lineas.forEach((l, i) => ctx.fillText(l, x, y + i * tam * 1.18));
  return y + lineas.length * tam * 1.18;
}

// Pared clara con luz suave y una mesa de madera abajo, como una foto de estudio.
function dibujarEstudio(ctx: CanvasRenderingContext2D, W: number, alto: number, mesa: number, fondo: string) {
  const pared = ctx.createLinearGradient(0, 0, 0, mesa);
  pared.addColorStop(0, "#ffffff");
  pared.addColorStop(1, fondo);
  ctx.fillStyle = pared;
  ctx.fillRect(0, 0, W, mesa);
  const luz = ctx.createRadialGradient(W * 0.72, mesa * 0.35, 20, W * 0.72, mesa * 0.35, W * 0.7);
  luz.addColorStop(0, "rgba(255,255,255,0.75)");
  luz.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, W, mesa);

  // Mesa de madera con vetas.
  const madera = ctx.createLinearGradient(0, mesa, 0, alto);
  madera.addColorStop(0, "#d9b38c");
  madera.addColorStop(1, "#b07d52");
  ctx.fillStyle = madera;
  ctx.fillRect(0, mesa, W, alto - mesa);
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, mesa, W, alto - mesa);
  ctx.clip();
  for (let i = 0; i < 46; i++) {
    const y0 = mesa + azar() * (alto - mesa);
    ctx.strokeStyle = `rgba(${azar() > 0.5 ? "90,55,25" : "255,235,210"},${0.06 + azar() * 0.1})`;
    ctx.lineWidth = 1 + azar() * 3;
    ctx.beginPath();
    const amp = 2 + azar() * 6;
    const fase = azar() * 10;
    for (let x = 0; x <= W; x += 20) {
      const yy = y0 + Math.sin(x / (90 + azar() * 4) + fase) * amp;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
  // Borde de la mesa y sombra de la pared.
  const borde = ctx.createLinearGradient(0, mesa - 18, 0, mesa + 10);
  borde.addColorStop(0, "rgba(0,0,0,0)");
  borde.addColorStop(1, "rgba(0,0,0,0.10)");
  ctx.fillStyle = borde;
  ctx.fillRect(0, mesa - 18, W, 28);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(0, mesa, W, 2);
}

// Saca el fondo blanco o muy claro que toca los bordes de la foto (fotos de
// producto sobre fondo blanco). Si la foto no tiene ese fondo, devuelve null.
function recortarFondo(img: HTMLImageElement): HTMLCanvasElement | null {
  try {
    const escala = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * escala);
    const h = Math.round(img.naturalHeight * escala);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    const datos = ctx.getImageData(0, 0, w, h);
    const px = datos.data;
    const claro = (i: number) => {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      return r > 222 && g > 222 && b > 222 && Math.max(r, g, b) - Math.min(r, g, b) < 22;
    };
    // ¿El borde es mayormente claro?
    let bordeClaro = 0;
    let bordeTotal = 0;
    for (let x = 0; x < w; x += 4) {
      bordeTotal += 2;
      if (claro((x) * 4)) bordeClaro++;
      if (claro(((h - 1) * w + x) * 4)) bordeClaro++;
    }
    for (let y = 0; y < h; y += 4) {
      bordeTotal += 2;
      if (claro((y * w) * 4)) bordeClaro++;
      if (claro((y * w + w - 1) * 4)) bordeClaro++;
    }
    if (bordeClaro / bordeTotal < 0.7) return null;

    // Relleno desde los bordes: todo lo claro conectado al borde es fondo.
    const fondo = new Uint8Array(w * h);
    const pila: number[] = [];
    const empujar = (k: number) => {
      if (!fondo[k] && claro(k * 4)) {
        fondo[k] = 1;
        pila.push(k);
      }
    };
    for (let x = 0; x < w; x++) {
      empujar(x);
      empujar((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      empujar(y * w);
      empujar(y * w + w - 1);
    }
    while (pila.length) {
      const k = pila.pop()!;
      const x = k % w;
      if (x > 0) empujar(k - 1);
      if (x < w - 1) empujar(k + 1);
      if (k >= w) empujar(k - w);
      if (k < w * (h - 1)) empujar(k + w);
    }
    let minX = w, minY = h, maxX = 0, maxY = 0, quedan = 0;
    for (let k = 0; k < w * h; k++) {
      if (fondo[k]) {
        px[k * 4 + 3] = 0;
        continue;
      }
      quedan++;
      const x = k % w;
      const y = (k / w) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      // Borde suave: si toca el fondo, un poco transparente.
      const vecinoFondo =
        (x > 0 && fondo[k - 1]) || (x < w - 1 && fondo[k + 1]) || (k >= w && fondo[k - w]) || (k < w * (h - 1) && fondo[k + w]);
      if (vecinoFondo) px[k * 4 + 3] = 150;
    }
    const parte = quedan / (w * h);
    if (parte < 0.05 || parte > 0.97) return null;
    ctx.putImageData(datos, 0, 0);
    const salida = document.createElement("canvas");
    salida.width = maxX - minX + 1;
    salida.height = maxY - minY + 1;
    salida.getContext("2d")!.drawImage(c, minX, minY, salida.width, salida.height, 0, 0, salida.width, salida.height);
    return salida;
  } catch {
    return null; // por ejemplo, si la foto no se puede leer (CORS)
  }
}

export async function armarFichaDetallada(
  d: DatosFichaFoto,
  fotoPrincipal: string,
  variantes: string[] = []
): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const p = PALETAS.find((x) => x.id === d.paleta) || PALETAS[0];
  const [principal, ...otras] = await Promise.all(
    [fotoPrincipal, ...variantes.slice(0, 3)].map((u) => cargarImagen(u))
  );
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  const cta = d.cta.trim();
  const altoCta = cta ? 120 : 0;
  const M = 56;
  const izq = 500; // ancho de la columna de textos

  // Producto grande a la derecha, entero, sin que lo tape el cuadro de venta.
  const fx = M + izq + 24;
  const fw = W - fx - 32;
  const cajaT = d.cajaTitulo.trim();
  const cajaX = d.cajaTexto.trim();
  const bw = Math.min(fw, 470);
  const medir = document.createElement("canvas").getContext("2d")!;
  medir.font = `500 21px ${FUENTE}`;
  const lineasCaja = cajaX ? partir(medir, cajaX, bw - 48).slice(0, 6) : [];
  const bh = cajaT || cajaX ? 36 + (cajaT ? 44 : 0) + lineasCaja.length * 25 + 28 : 0;
  const fh = H - altoCta - 64 - (bh ? bh + 24 : 0);
  // Foto de estudio: se le saca el fondo claro y el producto queda parado sobre
  // una mesa de madera, con luz suave y sombra (sin tocar el producto).
  const recorte = recortarFondo(principal);
  const fuente: CanvasImageSource = recorte || principal;
  const iw = recorte ? recorte.width : principal.naturalWidth;
  const ih = recorte ? recorte.height : principal.naturalHeight;
  const margen = recorte ? 0 : 32;
  const esc = Math.min((fw - margen) / iw, (fh - margen) / ih);
  const pw = iw * esc;
  const ph = ih * esc;
  const px = fx + (fw - pw) / 2;
  // Recortado, apoyado abajo (sobre la mesa); si no, centrado.
  const py = recorte ? 40 + fh - ph : 40 + (fh - ph) / 2;
  const base = py + ph; // donde apoya el producto
  dibujarEstudio(ctx, W, H - altoCta, Math.min(base - 70, H - altoCta - 200), p.fondo);

  if (recorte) {
    // Sombra de contacto sobre la mesa.
    ctx.save();
    const g = ctx.createRadialGradient(px + pw / 2, base, 4, px + pw / 2, base, pw * 0.6);
    g.addColorStop(0, "rgba(40,25,10,0.45)");
    g.addColorStop(1, "rgba(40,25,10,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(px + pw / 2, base, pw * 0.6, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 14;
    ctx.shadowOffsetY = 10;
    ctx.filter = "contrast(1.07) saturate(1.1) brightness(1.03)";
    ctx.drawImage(fuente, px, py, pw, ph);
    ctx.restore();
  } else {
    // Sin poder sacar el fondo: la foto va sobre una tarjeta blanca redondeada.
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.16)";
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = "#fff";
    redondeado(ctx, px - 16, py - 16, pw + 32, ph + 32, 28);
    ctx.fill();
    ctx.restore();
    ctx.save();
    redondeado(ctx, px, py, pw, ph, 16);
    ctx.clip();
    ctx.filter = "contrast(1.07) saturate(1.1) brightness(1.03)";
    ctx.drawImage(fuente, px, py, pw, ph);
    ctx.restore();
  }

  // Columna de textos.
  let y = 56;
  const palabras = d.titulo.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (palabras.length) {
    // La primera mitad en color fuerte y el resto en el acento (como "PLANTILLAS / GUAPA").
    const corte = Math.max(1, Math.ceil(palabras.length / 2));
    let tam = 72;
    ctx.font = `900 ${tam}px ${FUENTE}`;
    while (tam > 40 && partir(ctx, palabras.join(" "), izq).length > 4) {
      tam -= 4;
      ctx.font = `900 ${tam}px ${FUENTE}`;
    }
    y = renglones(ctx, palabras.slice(0, corte).join(" "), M, y, izq, tam, 900, p.fuerte, 2);
    if (palabras.length > corte) y = renglones(ctx, palabras.slice(corte).join(" "), M, y, izq, tam, 900, p.acento, 2);
    y += 18;
  }

  const frase = d.frase.trim();
  if (frase) {
    ctx.font = `800 26px ${FUENTE}`;
    const ancho = Math.min(izq, ctx.measureText(frase.toUpperCase()).width + 44);
    ctx.fillStyle = p.fuerte;
    redondeado(ctx, M, y, ancho, 50, 10);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(partir(ctx, frase.toUpperCase(), ancho - 44)[0], M + 22, y + 12);
    y += 70;
  }

  const talles = d.talles.trim();
  if (talles) {
    y = renglones(ctx, talles.toUpperCase(), M, y, izq, 52, 900, p.fuerte, 2) + 26;
  }

  // Beneficios con íconos.
  const beneficios = d.beneficios.filter((b) => b.titulo.trim() || b.texto.trim()).slice(0, 4);
  const limiteBeneficios = H - altoCta - (d.colores.trim() || otras.length ? 330 : 60);
  beneficios.forEach((b, i) => {
    if (y > limiteBeneficios - 60) return;
    const r = 34;
    ctx.fillStyle = i % 2 === 1 ? p.acento : p.fuerte;
    ctx.beginPath();
    ctx.arc(M + r, y + r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `800 30px ${FUENTE}`;
    ctx.textAlign = "center";
    ctx.fillText(ICONOS[i], M + r, y + r - 16);
    ctx.textAlign = "left";
    const tx = M + r * 2 + 22;
    const ancho = izq - r * 2 - 22;
    let yy = y + 2;
    if (b.titulo.trim()) yy = renglones(ctx, b.titulo.trim().toUpperCase(), tx, yy, ancho, 26, 800, p.fuerte, 2) + 4;
    if (b.texto.trim()) yy = renglones(ctx, b.texto.trim(), tx, yy, ancho, 21, 500, "#374151", 3);
    y = Math.max(y + r * 2, yy) + 26;
  });

  // "Elegí la tuya": otras fotos (variantes) o los colores del catálogo.
  const colores = d.colores
    .split(/,|·|\//)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 4);
  if (otras.length || colores.length) {
    // Justo debajo de los beneficios (sin dejar un hueco grande en el medio).
    const yb = Math.min(H - altoCta - 300, y + 40);
    ctx.font = `800 24px ${FUENTE}`;
    ctx.fillStyle = p.fuerte;
    ctx.fillText("ELEGÍ LA TUYA  →", M, yb);
    const n = Math.max(otras.length, colores.length);
    const celda = Math.min(150, (izq - (n - 1) * 16) / n);
    for (let i = 0; i < n; i++) {
      const x = M + i * (celda + 16);
      const yy = yb + 44;
      const nombre = colores[i] || "";
      if (otras[i]) {
        fotoEn(ctx, otras[i], x, yy + 34, celda, 200);
      } else {
        const hex = COLORES[nombre.toLowerCase()] || "#d1d5db";
        ctx.fillStyle = hex;
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x + celda / 2, yy + 110, Math.min(60, celda / 2 - 4), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      if (nombre) {
        ctx.font = `800 20px ${FUENTE}`;
        ctx.fillStyle = "#1f2937";
        ctx.textAlign = "center";
        ctx.fillText(nombre.toUpperCase(), x + celda / 2, yy);
        ctx.textAlign = "left";
      }
    }
  }

  // Cuadro de venta (por ejemplo, para responder "¿Te parece caro?").
  if (bh) {
    const bx = W - bw - 32;
    const lineas = lineasCaja;
    const by = H - altoCta - bh - 24;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    redondeado(ctx, bx, by, bw, bh, 18);
    ctx.fill();
    ctx.restore();
    let yy = by + 26;
    if (cajaT) yy = renglones(ctx, cajaT, bx + 24, yy, bw - 48, 30, 800, p.fuerte, 1) + 10;
    ctx.font = `500 21px ${FUENTE}`;
    ctx.fillStyle = "#1f2937";
    lineas.forEach((l, i) => ctx.fillText(l, bx + 24, yy + i * 25));
  }

  // Cinta de abajo con el llamado a la acción.
  if (cta) {
    ctx.fillStyle = p.fuerte;
    ctx.fillRect(0, H - altoCta, W, altoCta);
    ctx.font = `900 40px ${FUENTE}`;
    let tam = 40;
    while (tam > 24 && ctx.measureText(cta.toUpperCase()).width > W - M * 2) {
      tam -= 2;
      ctx.font = `900 ${tam}px ${FUENTE}`;
    }
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(cta.toUpperCase(), W / 2, H - altoCta / 2 - tam / 2 - 10);
    ctx.font = `600 22px ${FUENTE}`;
    ctx.fillStyle = p.acento;
    ctx.fillText("SOLO VENTAS · www.soloventas.com.ar", W / 2, H - 38);
    ctx.textAlign = "left";
  }

  return new Promise((ok, mal) =>
    c.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo armar la foto detallada."))), "image/jpeg", 0.92)
  );
}
