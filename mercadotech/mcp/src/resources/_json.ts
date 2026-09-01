import type { TextResourceContents } from "@modelcontextprotocol/sdk/types.js";

/**
 * Da forma al ÚNICO `content` de texto que devuelve cada resource de esta
 * sesión (todos son JSON). No es un archivo `_index`: el guion bajo es a
 * propósito para que quede visualmente aparte de los 7 resources reales del
 * directorio.
 */
export function jsonText(uri: string, data: unknown): TextResourceContents {
  return { uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) };
}
