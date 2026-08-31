import {
  HUGGINGFACE_CHAT_MAX_TOKENS,
  HUGGINGFACE_CHAT_MODEL_DEFAULT,
} from "@/lib/constants/ai";

// Generación de texto: acá SÍ se usa fetch y NO el SDK, al revés que en
// lib/ai/embeddings.ts. El router de Hugging Face es una fachada
// OpenAI-compatible cuyo contrato es un JSON trivial ({model, max_tokens,
// messages} → choices[0].message.content), así que un fetch alcanza y no ata
// el proyecto a la superficie del SDK.
const ROUTER_URL = "https://router.huggingface.co/v1/chat/completions";

export type CompletionResult = {
  text: string;
  model: string;
  stopReason: string | null;
};

function getToken(): string {
  const token = process.env.HUGGINGFACEHUB_API_TOKEN;
  if (!token) {
    throw new Error(
      "HUGGINGFACEHUB_API_TOKEN no está configurada. Agrégala a .env.local " +
        "(token de tipo Read de huggingface.co/settings/tokens) y reinicia el servidor.",
    );
  }
  return token;
}

function getModel(): string {
  return process.env.HUGGINGFACE_CHAT_MODEL || HUGGINGFACE_CHAT_MODEL_DEFAULT;
}

/**
 * Pide al modelo de chat que redacte una respuesta.
 *
 * @param system Instrucciones de comportamiento (el "rol" del asistente).
 * @param user   El mensaje del usuario, ya enriquecido con el contexto RAG.
 */
export async function generateCompletion(
  system: string,
  user: string,
): Promise<CompletionResult> {
  const model = getModel();

  let response: Response;
  try {
    response = await fetch(ROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: HUGGINGFACE_CHAT_MAX_TOKENS,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (error) {
    // Falla de red antes de llegar al proveedor: no es ni token ni modelo.
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`No se pudo contactar a Hugging Face para generar la respuesta: ${message}`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    // Errores accionables: cada causa tiene una solución distinta, así que
    // cada una tiene su mensaje. Es lo que permite diagnosticar sin leer
    // este archivo.
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Hugging Face rechazó el token al generar la respuesta (401). " +
          "Revisa HUGGINGFACEHUB_API_TOKEN en .env.local: debe empezar con hf_ " +
          "y no estar revocado.",
      );
    }
    if (response.status === 429) {
      throw new Error(
        "Se agotó la cuota gratuita de Hugging Face (429). Espera o revisa el " +
          "consumo en huggingface.co → Settings → Billing.",
      );
    }
    // La disponibilidad de modelos gratuitos rota sin aviso: este es el caso
    // más probable de todos a mediano plazo, y la solución NO es tocar código.
    if (/not supported|no provider|not a chat model|does not exist/i.test(body)) {
      throw new Error(
        `El modelo de chat "${model}" ya no está disponible en el nivel gratuito ` +
          "de Hugging Face. Cambia HUGGINGFACE_CHAT_MODEL en .env.local por otro " +
          "modelo instruct probado contra la API — no hace falta tocar código.",
      );
    }
    throw new Error(
      `Hugging Face devolvió ${response.status} al generar la respuesta con "${model}": ` +
        body.slice(0, 200),
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Hugging Face devolvió una respuesta que no es JSON válido con "${model}".`,
    );
  }

  const choice = (
    data as { choices?: { message?: { content?: string }; finish_reason?: string }[] }
  )?.choices?.[0];
  const text = choice?.message?.content;

  // Respuesta 200 pero sin contenido utilizable: es un fallo del proveedor,
  // distinto de token o modelo, y merece su propio mensaje.
  if (typeof text !== "string" || !text.trim()) {
    throw new Error(
      `El modelo "${model}" devolvió una respuesta vacía o con formato inesperado ` +
        "(sin choices[0].message.content). Reintenta; si persiste, prueba otro " +
        "modelo con HUGGINGFACE_CHAT_MODEL.",
    );
  }

  return {
    text: text.trim(),
    model,
    stopReason: choice?.finish_reason ?? null,
  };
}
