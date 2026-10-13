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

function tipoDeVideo() {
  const opciones = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  return opciones.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) || "";
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

function dibujarTexto(
  ctx: CanvasRenderingContext2D,
  texto: string,
  pos: "arriba" | "abajo",
  W: number,
  H: number
) {
  const tam = Math.round(W * 0.07);
  ctx.font = `800 ${tam}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lineas = lineasDeTexto(ctx, texto.toUpperCase(), W * 0.8);
  const alto = lineas.length * tam * 1.2 + tam * 0.8;
  const anchoCaja = Math.min(W * 0.9, Math.max(...lineas.map((l) => ctx.measureText(l).width)) + tam * 1.2);
  const y0 = pos === "abajo" ? H * 0.86 - alto : H * 0.08;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  const x0 = (W - anchoCaja) / 2;
  const r = tam * 0.35;
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0);
  ctx.arcTo(x0 + anchoCaja, y0, x0 + anchoCaja, y0 + alto, r);
  ctx.arcTo(x0 + anchoCaja, y0 + alto, x0, y0 + alto, r);
  ctx.arcTo(x0, y0 + alto, x0, y0, r);
  ctx.arcTo(x0, y0, x0 + anchoCaja, y0, r);
  ctx.fill();
  ctx.fillStyle = "#fff";
  lineas.forEach((l, i) => ctx.fillText(l, W / 2, y0 + tam * 0.4 + tam * 1.2 * (i + 0.5)));
}

function dibujarFoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number, t: number, i: number) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  // Fondo: la misma foto agrandada y desenfocada.
  const cubre = Math.max(W / iw, H / ih) * 1.1;
  ctx.save();
  ctx.filter = "blur(40px) brightness(0.75)";
  ctx.drawImage(img, (W - iw * cubre) / 2, (H - ih * cubre) / 2, iw * cubre, ih * cubre);
  ctx.restore();
  // Frente: la foto entera, con un acercamiento suave (efecto Ken Burns).
  const entra = Math.min((W * 0.92) / iw, (H * 0.72) / ih);
  const zoom = 1 + 0.12 * t;
  const w = iw * entra * zoom;
  const h = ih * entra * zoom;
  const corrimiento = (i % 2 === 0 ? 1 : -1) * W * 0.03 * t;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 40;
  ctx.drawImage(img, (W - w) / 2 + corrimiento, (H - h) / 2, w, h);
  ctx.restore();
}

export type VideoArmado = { blob: Blob; tipo: string; extension: "mp4" | "webm" };

// Arma el video en tiempo real (tarda lo mismo que dura el video).
export async function armarVideo(opciones: {
  urls: string[];
  segundos: number;
  texto?: string;
  textoPos?: "arriba" | "abajo";
  onProgreso?: (p: number) => void;
}): Promise<VideoArmado> {
  const tipo = tipoDeVideo();
  if (!tipo) throw new Error("Este navegador no puede armar videos. Probá con Chrome.");
  const imgs = await Promise.all(opciones.urls.map(cargarImagen));
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const flujo = canvas.captureStream(30);
  const grabador = new MediaRecorder(flujo, { mimeType: tipo, videoBitsPerSecond: 6_000_000 });
  const partes: Blob[] = [];
  grabador.ondataavailable = (e) => e.data.size && partes.push(e.data);
  const terminado = new Promise<void>((ok) => (grabador.onstop = () => ok()));

  const total = opciones.segundos * 1000;
  const porFoto = total / imgs.length;
  const fundido = Math.min(600, porFoto / 3);

  const cuadro = (ms: number) => {
    const i = Math.min(imgs.length - 1, Math.floor(ms / porFoto));
    const t = (ms - i * porFoto) / porFoto;
    ctx.globalAlpha = 1;
    dibujarFoto(ctx, imgs[i], W, H, t, i);
    const resto = porFoto - (ms - i * porFoto);
    if (i < imgs.length - 1 && resto < fundido) {
      ctx.globalAlpha = 1 - resto / fundido;
      dibujarFoto(ctx, imgs[i + 1], W, H, 0, i + 1);
      ctx.globalAlpha = 1;
    }
    const texto = opciones.texto?.trim();
    if (texto) dibujarTexto(ctx, texto, opciones.textoPos || "arriba", W, H);
  };

  cuadro(0);
  grabador.start(250);
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
  flujo.getTracks().forEach((t) => t.stop());
  const base = tipo.split(";")[0];
  return {
    blob: new Blob(partes, { type: base }),
    tipo: base,
    extension: base === "video/mp4" ? "mp4" : "webm",
  };
}
