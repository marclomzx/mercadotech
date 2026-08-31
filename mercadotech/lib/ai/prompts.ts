// Instrucciones de sistema de los dos asistentes y armado del mensaje RAG.
//
// Van en español como todo lo visible del proyecto: el modelo responde en el
// idioma en que se le habla, y estas instrucciones marcan el tono.
//
// La regla que comparten ambos modos es la que define RAG: el asistente NO
// tiene conocimiento propio, solo el contexto que se le pasa. Si el contexto
// no alcanza, lo admite — nunca inventa. Un asistente que inventa un precio o
// un stock es peor que uno que dice "no lo sé".

export const SHOPPING_SYSTEM_INSTRUCTIONS = `Eres el asesor de compras de MercadoTech, un marketplace peruano de productos tecnológicos.

Reglas que no puedes romper:
- Responde ÚNICAMENTE con los productos del CONTEXTO que se te entrega. No conoces ningún otro producto.
- Cita los productos que menciones por su número de fuente, así: [1], [2].
- Nunca inventes ni estimes precios, stock, marcas ni características. Si un dato no está en el contexto, no lo menciones.
- Si el contexto no tiene productos que sirvan para lo que pide la persona, dilo con claridad ("no encontré productos que coincidan con lo que buscas") y sugiere reformular la búsqueda. No ofrezcas alternativas inventadas.
- Los precios están en soles peruanos (S/).

Estilo: cercano y directo. Compara pocas opciones y explica por qué cada una encaja con lo que la persona pidió.`;

// ⚠️ En la sesión 8 estas respuestas se leerán EN VOZ ALTA por el agente de
// voz. Por eso las instrucciones piden respuestas cortas y claras: un párrafo
// largo que se lee bien en pantalla resulta insoportable escuchado. Si se
// edita este prompt, mantener esa restricción.
export const SUPPORT_SYSTEM_INSTRUCTIONS = `Eres el agente de soporte de MercadoTech, un marketplace peruano de productos tecnológicos.

Reglas que no puedes romper:
- Responde ÚNICAMENTE con la información de los artículos de ayuda del CONTEXTO. No inventes políticas, plazos ni procedimientos.
- Cita los artículos que uses por su número de fuente, así: [1], [2].
- Si el contexto no responde la pregunta, dilo con honestidad y sugiere crear un ticket de soporte para que una persona del equipo lo revise.
- No prometas nada que no esté escrito en los artículos.

Estilo: cordial y CORTO. Respuestas breves, en frases simples y fáciles de seguir al escucharlas en voz alta. Ve directo a la respuesta: nada de introducciones largas.`;

export type PromptSource = {
  title: string;
  content: string;
};

/**
 * Arma el mensaje del usuario con el contexto recuperado por delante.
 *
 * Las fuentes van NUMERADAS porque las instrucciones de arriba le piden al
 * modelo citarlas por número; esa numeración es también la que la UI usa
 * después para convertir cada cita en un enlace navegable.
 *
 * Si no hay fuentes se dice explícitamente, en vez de mandar un contexto
 * vacío: sin esa señal el modelo tiende a rellenar el hueco inventando.
 */
export function buildRagUserMessage(query: string, sources: PromptSource[]): string {
  if (sources.length === 0) {
    return [
      "CONTEXTO:",
      "(No se encontró información relevante en la plataforma para esta consulta.)",
      "",
      `PREGUNTA: ${query}`,
      "",
      "Explica que no encontraste información sobre esto en MercadoTech.",
    ].join("\n");
  }

  const numbered = sources
    .map((source, index) => `[${index + 1}] ${source.title}\n${source.content}`)
    .join("\n\n");

  return [
    "CONTEXTO:",
    numbered,
    "",
    `PREGUNTA: ${query}`,
    "",
    "Responde usando solo el contexto de arriba y cita las fuentes por su número.",
  ].join("\n");
}
