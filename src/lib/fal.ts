// Conexión con fal.ai para generar fotos y videos con IA.
// Necesita en Vercel: FAL_KEY. Sin esa clave, el Estudio IA funciona en
// modo gratis (copiar la instrucción en Gemini / AI Studio).

export function falConfigurado() {
  return Boolean(process.env.FAL_KEY);
}

function cabeceras() {
  return {
    Authorization: `Key ${process.env.FAL_KEY}`,
    "Content-Type": "application/json",
  };
}

async function leer(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detalle =
      (typeof data?.detail === "string" && data.detail) ||
      data?.detail?.[0]?.msg ||
      data?.error ||
      `Error ${res.status} de fal.ai`;
    throw new Error(detalle);
  }
  return data;
}

// Encola un trabajo. fal.ai responde enseguida con las URLs para consultar
// el estado y buscar el resultado cuando esté listo.
export async function enviarAFal(modelo: string, input: Record<string, unknown>) {
  const data = await leer(
    await fetch(`https://queue.fal.run/${modelo}`, {
      method: "POST",
      headers: cabeceras(),
      body: JSON.stringify(input),
      cache: "no-store",
    })
  );
  if (!data.status_url || !data.response_url) {
    throw new Error("fal.ai no devolvió el trabajo.");
  }
  return { statusUrl: data.status_url as string, responseUrl: data.response_url as string };
}

export async function estadoFal(statusUrl: string): Promise<string> {
  const data = await leer(
    await fetch(statusUrl, { headers: cabeceras(), cache: "no-store" })
  );
  return String(data.status || "");
}

export async function resultadoFal(responseUrl: string) {
  return leer(await fetch(responseUrl, { headers: cabeceras(), cache: "no-store" }));
}
