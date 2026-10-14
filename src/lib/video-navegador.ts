// Herramientas gratis que corren en el navegador, sin ninguna IA paga:
// - cargar fotos del producto en un canvas (con CORS o por el proxy del panel)
// - achicarlas para mandarlas como referencia a la IA gratis
// - armar un video vertical con las fotos (movimiento suave, transiciones y texto)

export function cargarImagen(url: string): Promise<HTMLImageElement> {
  const intentar = (src: string) =>
    new Promise<HTMLImageElement>((ok, mal) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => ok(img);
      img.onerror = () => mal(new Error("No se pudo cargar la foto."));
      img.src = src;
    });
  return intentar(url).catch(() => intentar(`/api/media/publica?u=${encodeURIComponent(url)}`));
}

// Achica una foto para que el lado más largo mida como máximo `maximo` px.
export async function achicarFoto(url: string, maximo = 500): Promise<Blob> {
  const img = await cargarImagen(url);
  const escala = Math.min(1, maximo / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * escala);
  c.height = Math.round(img.naturalHeight * escala);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((ok, mal) =>
    c.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo preparar la foto."))), "image/jpeg", 0.9)
  );
}

function tipoDeVideo(conAudio: boolean) {
  const opciones = conAudio
    ? [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4;codecs=avc1,mp4a",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm",
      ]
    : ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  return opciones.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) || "";
}

// ---- Opciones del editor (lo que en CapCut harías a mano) ----

export type Transicion = "fundido" | "deslizar" | "zoom" | "corte";
export type EstiloTexto = "caja" | "pop" | "escribir" | "neon";
export type PosTexto = "arriba" | "centro" | "abajo";
export type PosSticker = "arriba-izq" | "arriba-der" | "abajo-izq" | "abajo-der";

export const TRANSICIONES: { id: Transicion; nombre: string }[] = [
  { id: "fundido", nombre: "Fundido" },
  { id: "deslizar", nombre: "Deslizar" },
  { id: "zoom", nombre: "Zoom" },
  { id: "corte", nombre: "Corte seco" },
];

export const ESTILOS_TEXTO: { id: EstiloTexto; nombre: string }[] = [
  { id: "caja", nombre: "Caja" },
  { id: "pop", nombre: "Aparece con rebote" },
  { id: "escribir", nombre: "Se va escribiendo" },
  { id: "neon", nombre: "Neón" },
];

export const STICKERS: { id: string; texto: string; fondo: string; color: string }[] = [
  { id: "nuevo", texto: "NUEVO", fondo: "#16a34a", color: "#fff" },
  { id: "oferta", texto: "OFERTA", fondo: "#dc2626", color: "#fff" },
  { id: "hot", texto: "🔥 HOT", fondo: "#f97316", color: "#fff" },
  { id: "top", texto: "⭐ TOP VENTAS", fondo: "#facc15", color: "#111" },
  { id: "envios", texto: "🚚 ENVÍOS", fondo: "#2563eb", color: "#fff" },
  { id: "mayorista", texto: "PRECIO MAYORISTA", fondo: "#7c3aed", color: "#fff" },
  { id: "regalo", texto: "🎁 IDEAL PARA REGALAR", fondo: "#db2777", color: "#fff" },
];

export type TextoVideo = { texto: string; pos: PosTexto; estilo: EstiloTexto };

export type OpcionesVideo = {
  urls: string[];
  segundosPorFoto: number;
  transicion?: Transicion;
  movimiento?: boolean;
  textos?: TextoVideo[];
  sticker?: { id: string; pos: PosSticker } | null;
  musica?: { archivo: Blob; volumen: number } | null;
  cierre?: boolean; // placa final con la marca
  onProgreso?: (p: number) => void;
};

function caja(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lineasDeTexto(ctx: CanvasRenderingContext2D, texto: string, ancho: number) {
  const palabras = texto.split(" ");
  const lineas: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width > ancho && actual) {
      lineas.push(actual);
      actual = p;
    } else actual = prueba;
  }
  if (actual) lineas.push(actual);
  return lineas.slice(0, 3);
}

// Dibuja un texto con su animación; `ms` es el tiempo desde que empezó el video.
function dibujarTexto(ctx: CanvasRenderingContext2D, t: TextoVideo, W: number, H: number, ms: number, indice: number) {
  const inicio = indice * 350; // el segundo texto entra un poquito después
  const desde = ms - inicio;
  if (desde < 0) return;
  const tam = Math.round(W * 0.07);
  ctx.save();
  ctx.font = `800 ${tam}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let texto = t.texto.toUpperCase();
  if (t.estilo === "escribir") {
    const letras = Math.floor(desde / 45);
    texto = texto.slice(0, Math.max(1, letras));
  }
  const lineas = lineasDeTexto(ctx, t.texto.toUpperCase(), W * 0.8);
  const visibles = t.estilo === "escribir" ? lineasDeTexto(ctx, texto, W * 0.8) : lineas;
  const alto = lineas.length * tam * 1.2 + tam * 0.8;
  const anchoCaja = Math.min(W * 0.9, Math.max(...lineas.map((l) => ctx.measureText(l).width)) + tam * 1.2);
  const y0 = t.pos === "abajo" ? H * 0.84 - alto : t.pos === "centro" ? (H - alto) / 2 : H * 0.08;
  let escala = 1;
  if (t.estilo === "pop") {
    const k = Math.min(1, desde / 450);
    escala = k < 1 ? 0.3 + 0.7 * k + Math.sin(k * Math.PI) * 0.25 : 1;
  }
  ctx.translate(W / 2, y0 + alto / 2);
  ctx.scale(escala, escala);
  ctx.translate(-W / 2, -(y0 + alto / 2));
  if (t.estilo === "neon") {
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = tam * 0.6;
    ctx.lineWidth = tam * 0.12;
    ctx.strokeStyle = "#0e7490";
    ctx.fillStyle = "#ecfeff";
    visibles.forEach((l, i) => {
      const y = y0 + tam * 0.4 + tam * 1.2 * (i + 0.5);
      ctx.strokeText(l, W / 2, y);
      ctx.fillText(l, W / 2, y);
    });
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    caja(ctx, (W - anchoCaja) / 2, y0, anchoCaja, alto, tam * 0.35);
    ctx.fill();
    ctx.fillStyle = "#fff";
    visibles.forEach((l, i) => ctx.fillText(l, W / 2, y0 + tam * 0.4 + tam * 1.2 * (i + 0.5)));
  }
  ctx.restore();
}

function dibujarSticker(ctx: CanvasRenderingContext2D, id: string, pos: PosSticker, W: number, H: number, ms: number) {
  const s = STICKERS.find((x) => x.id === id);
  if (!s) return;
  const tam = Math.round(W * 0.045);
  ctx.save();
  ctx.font = `900 ${tam}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const w = ctx.measureText(s.texto).width + tam * 1.4;
  const h = tam * 2;
  const x = pos.endsWith("izq") ? W * 0.06 + w / 2 : W * 0.94 - w / 2;
  const y = pos.startsWith("arriba") ? H * 0.2 : H * 0.7;
  const latido = 1 + Math.sin(ms / 260) * 0.05;
  ctx.translate(x, y);
  ctx.rotate(pos.endsWith("izq") ? -0.12 : 0.12);
  ctx.scale(latido, latido);
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = s.fondo;
  caja(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = s.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(s.texto, 0, 2);
  ctx.restore();
}

function dibujarFoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number,
  H: number,
  t: number,
  i: number,
  movimiento: boolean,
  extra: { dx?: number; escala?: number } = {}
) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  // Fondo: la misma foto agrandada y desenfocada.
  const cubre = Math.max(W / iw, H / ih) * 1.1;
  ctx.save();
  ctx.filter = "blur(40px) brightness(0.75)";
  ctx.drawImage(img, (W - iw * cubre) / 2 + (extra.dx || 0), (H - ih * cubre) / 2, iw * cubre, ih * cubre);
  ctx.restore();
  // Frente: la foto entera, con un acercamiento suave (efecto Ken Burns).
  const entra = Math.min((W * 0.92) / iw, (H * 0.72) / ih);
  const zoom = (movimiento ? 1 + 0.12 * t : 1) * (extra.escala || 1);
  const w = iw * entra * zoom;
  const h = ih * entra * zoom;
  const corrimiento = movimiento ? (i % 2 === 0 ? 1 : -1) * W * 0.03 * t : 0;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 40;
  ctx.drawImage(img, (W - w) / 2 + corrimiento + (extra.dx || 0), (H - h) / 2, w, h);
  ctx.restore();
}

function dibujarCierre(ctx: CanvasRenderingContext2D, W: number, H: number, k: number) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, k * 2);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0f1f3d");
  g.addColorStop(1, "#1e3a8a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.round(W * 0.11)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText("SOLO VENTAS", W / 2, H * 0.44);
  ctx.font = `600 ${Math.round(W * 0.05)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = "#facc15";
  ctx.fillText("www.soloventas.com.ar", W / 2, H * 0.53);
  ctx.fillStyle = "#e5e7eb";
  ctx.fillText("Consultanos ahora", W / 2, H * 0.6);
  ctx.restore();
}

export type VideoArmado = { blob: Blob; tipo: string; extension: "mp4" | "webm"; conMusica: boolean };

export const SEGUNDOS_CIERRE = 2;

// Duración total del video según las opciones.
export function duracionVideo(o: { urls: string[]; segundosPorFoto: number; cierre?: boolean }) {
  return o.urls.length * o.segundosPorFoto + (o.cierre ? SEGUNDOS_CIERRE : 0);
}

// Arma el video en tiempo real (tarda lo mismo que dura el video).
export async function armarVideo(opciones: OpcionesVideo): Promise<VideoArmado> {
  const conAudio = Boolean(opciones.musica);
  const tipo = tipoDeVideo(conAudio);
  if (!tipo) throw new Error("Este navegador no puede armar videos. Probá con Chrome.");
  const imgs = await Promise.all(opciones.urls.map(cargarImagen));
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const flujo = canvas.captureStream(30);

  // Música: se mezcla con Web Audio y se suma al video.
  let audioCtx: AudioContext | null = null;
  let fuente: AudioBufferSourceNode | null = null;
  let ganancia: GainNode | null = null;
  if (opciones.musica) {
    audioCtx = new AudioContext();
    const buffer = await audioCtx
      .decodeAudioData(await opciones.musica.archivo.arrayBuffer())
      .catch(() => {
        throw new Error("No se pudo leer la música. Probá con un archivo MP3.");
      });
    fuente = audioCtx.createBufferSource();
    fuente.buffer = buffer;
    fuente.loop = true;
    ganancia = audioCtx.createGain();
    ganancia.gain.value = opciones.musica.volumen;
    const destino = audioCtx.createMediaStreamDestination();
    fuente.connect(ganancia).connect(destino);
    destino.stream.getAudioTracks().forEach((t) => flujo.addTrack(t));
  }

  const grabador = new MediaRecorder(flujo, { mimeType: tipo, videoBitsPerSecond: 6_000_000 });
  const partes: Blob[] = [];
  grabador.ondataavailable = (e) => e.data.size && partes.push(e.data);
  const terminado = new Promise<void>((ok) => (grabador.onstop = () => ok()));

  const porFoto = opciones.segundosPorFoto * 1000;
  const fotosMs = porFoto * imgs.length;
  const total = duracionVideo(opciones) * 1000;
  const transicion = opciones.transicion || "fundido";
  const movimiento = opciones.movimiento !== false;
  const largo = transicion === "corte" ? 0 : Math.min(600, porFoto / 3);
  const textos = (opciones.textos || []).filter((t) => t.texto.trim());

  const cuadro = (ms: number) => {
    if (ms >= fotosMs && opciones.cierre) {
      dibujarCierre(ctx, W, H, (ms - fotosMs) / (SEGUNDOS_CIERRE * 1000));
      return;
    }
    const i = Math.min(imgs.length - 1, Math.floor(ms / porFoto));
    const t = (ms - i * porFoto) / porFoto;
    ctx.globalAlpha = 1;
    dibujarFoto(ctx, imgs[i], W, H, t, i, movimiento);
    const resto = porFoto - (ms - i * porFoto);
    if (i < imgs.length - 1 && largo && resto < largo) {
      const k = 1 - resto / largo; // 0 → 1 durante la transición
      if (transicion === "fundido") {
        ctx.globalAlpha = k;
        dibujarFoto(ctx, imgs[i + 1], W, H, 0, i + 1, movimiento);
      } else if (transicion === "deslizar") {
        dibujarFoto(ctx, imgs[i + 1], W, H, 0, i + 1, movimiento, { dx: W * (1 - k) });
      } else if (transicion === "zoom") {
        ctx.globalAlpha = k;
        dibujarFoto(ctx, imgs[i + 1], W, H, 0, i + 1, movimiento, { escala: 0.6 + 0.4 * k });
      }
      ctx.globalAlpha = 1;
    }
    textos.forEach((tx, n) => dibujarTexto(ctx, tx, W, H, ms, n));
    if (opciones.sticker) dibujarSticker(ctx, opciones.sticker.id, opciones.sticker.pos, W, H, ms);
  };

  cuadro(0);
  grabador.start(250);
  if (fuente && audioCtx && ganancia) {
    await audioCtx.resume();
    fuente.start();
    // La música baja suave en el último segundo.
    const fin = audioCtx.currentTime + total / 1000;
    ganancia.gain.setValueAtTime(opciones.musica!.volumen, Math.max(audioCtx.currentTime, fin - 1));
    ganancia.gain.linearRampToValueAtTime(0, fin);
  }
  const inicio = performance.now();
  await new Promise<void>((ok) => {
    const paso = () => {
      const ms = performance.now() - inicio;
      if (ms >= total) {
        cuadro(total - 1);
        ok();
        return;
      }
      cuadro(ms);
      opciones.onProgreso?.(Math.round((ms / total) * 100));
      // setTimeout sigue andando aunque la pestaña no esté al frente (más lento).
      setTimeout(paso, 1000 / 30);
    };
    paso();
  });
  grabador.stop();
  await terminado;
  fuente?.stop();
  await audioCtx?.close();
  flujo.getTracks().forEach((t) => t.stop());
  const base = tipo.split(";")[0];
  return {
    blob: new Blob(partes, { type: base }),
    tipo: base,
    extension: base === "video/mp4" ? "mp4" : "webm",
    conMusica: conAudio,
  };
}
