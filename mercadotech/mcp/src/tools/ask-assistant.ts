import { z } from "zod";

import * as chatService from "@/services/chat.service";

import { createContext } from "../context.js";
import { defineTool } from "../lib/define-tool.js";
import { jsonResult } from "../lib/tool-result.js";

export const askAssistantTool = defineTool({
  name: "ask_assistant",
  description:
    "Responde en prosa una pregunta del usuario usando SOLO el contenido " +
    'de MercadoTech, y cita sus fuentes: responde "¿cómo devuelvo un ' +
    'producto?" (modo soporte, busca en la ayuda) o "¿qué laptop me ' +
    'conviene para estudiar?" (modo compras, busca en el catálogo). Úsala ' +
    "cuando el usuario quiere una RESPUESTA redactada, no una lista de " +
    "productos; para una lista, semantic_search_products devuelve datos más " +
    "manejables.",
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe("La pregunta del usuario, tal como la haría, en español."),
    mode: z
      .enum(["compras", "soporte"])
      .describe(
        "'compras' busca en el catálogo de productos y aconseja qué comprar; " +
          "'soporte' busca en los artículos de ayuda (envíos, devoluciones, " +
          "garantías, pagos). Elige según de qué trate la pregunta.",
      ),
  }),
  // ⚠️ CLIENTE ADMIN (decisión 3), por la misma razón que
  // semantic_search_products: `chat.service.ask` entra a `knowledge_embeddings`
  // vía `vector-search.searchByQuery`, y esa tabla solo concede SELECT a
  // `authenticated`. Nótese además que `ask` es el único service del proyecto
  // cuyo cliente NO tiene default, justamente para forzar esta decisión.
  //
  // Requiere HUGGINGFACEHUB_API_TOKEN por partida doble (embedding + chat):
  // cualquiera de los dos que falte devuelve el error accionable de lib/ai/
  // como error de tool, nunca tumba el servidor.
  handler: async (input) => {
    const { admin } = createContext();

    const result = await chatService.ask(
      input.query,
      input.mode,
      {},
      admin, // cliente EXPLÍCITO (decisión 8).
    );

    return jsonResult(result.answer, {
      pregunta: result.query,
      respuesta: result.answer,
      // false = ninguna ficha superó el umbral: la respuesta existe igual,
      // pero conviene decirle al usuario que no salió del contenido real.
      hubo_contexto_relevante: result.hasRelevantContext,
      fuentes: result.sources.map((source) => ({
        tipo: source.sourceType,
        id: source.sourceId,
        titulo: source.title,
        similitud: source.similarity,
      })),
      modelo: result.metadata.model,
    });
  },
});
