import type { PromptMessage } from "@modelcontextprotocol/sdk/types.js";

/**
 * Los dos tipos de `PromptMessage` que usan los 5 Prompts MCP de esta
 * sesión (patrón de ReadHub, pedido por la Fase 5.4): un mensaje de
 * instrucciones en texto y el contenido real embebido como resource. El
 * guion bajo es a propósito, como en `resources/_json.ts`: no es un prompt.
 */

/** Mensaje de instrucciones para el modelo. */
export function textMessage(text: string): PromptMessage {
  return { role: "user", content: { type: "text", text } };
}

/**
 * Embebe datos ya obtenidos (vía las funciones compartidas de la 5.3) como
 * un resource dentro del mensaje — el prompt NO reimplementa recuperación:
 * el JSON que se adjunta aquí es el mismo que devolvería leer el resource o
 * llamar a la tool equivalente.
 */
export function embeddedJson(uri: string, data: unknown): PromptMessage {
  return {
    role: "user",
    content: {
      type: "resource",
      resource: { uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) },
    },
  };
}
