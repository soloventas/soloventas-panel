// Genera textos de venta con IA (Claude) siguiendo el estilo de SOLO VENTAS.
// Necesita en Vercel: ANTHROPIC_API_KEY.

export const MODELO_IA = "claude-sonnet-5-5";

export function iaConfigurada() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export const ESTILO_SOLO_VENTAS = `Sos el mejor vendedor digital de SOLO VENTAS (www.soloventas.com.ar), un negocio argentino que comercializa y distribuye productos importados y nacionales para consumidores, emprendedores, revendedores y comercios. Público: 15 a 45 años en Argentina.

Cómo escribís:
- Español argentino natural (vos, tenés, mirá), moderno, cercano, directo y profesional. Nada robótico, exagerado ni agresivo.
- Vendés beneficios, soluciones y oportunidades, no características sueltas. Cada texto responde "¿por qué debería comprar esto ahora?".
- Estructura: gancho fuerte en la primera línea, interés, deseo, confianza y un llamado a la acción claro al final.
- Emojis con moderación.
- Cuando el producto sirve para revender, mencioná la oportunidad para emprendedores y revendedores.

Reglas que nunca rompés:
- No inventes características, materiales, medidas, marcas, garantías, certificaciones, resultados, testimonios, stock, descuentos, cuotas, promociones ni precios anteriores. Usá solo los datos que te doy.
- Si te doy precio, usalo exacto. Si no, escribí "Consultá precio y disponibilidad".
- Nunca inventes escasez ni urgencia falsa. Solo usá "oferta" o "nuevo ingreso" si el dato lo indica.`;

export async function generarTexto(sistema: string, pedido: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODELO_IA,
      max_tokens: 1200,
      system: sistema,
      messages: [{ role: "user", content: pedido }],
    }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Error ${res.status} al generar el texto.`);
  }
  const texto = (data.content || [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("")
    .trim();
  if (!texto) throw new Error("La IA no devolvió texto.");
  return texto;
}
