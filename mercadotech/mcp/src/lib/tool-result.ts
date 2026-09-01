import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { describeError } from "./errors.js";

/**
 * Formateo consistente de resultados de tool.
 *
 * Toda tool devuelve DOS cosas por el mismo canal: un `text` legible (lo que
 * el modelo lee y puede citar) y, cuando hay datos, el mismo contenido como
 * JSON en `structuredContent` (lo que un cliente puede procesar). Centralizarlo
 * evita que cada tool invente su propio formato.
 */

/** Resultado de solo texto: confirmaciones, resúmenes, respuestas del asistente. */
export function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

/**
 * Resultado con datos: un encabezado en prosa + el JSON completo.
 *
 * El JSON va TAMBIÉN dentro del texto porque no todos los clientes MCP leen
 * `structuredContent`; duplicarlo es barato y garantiza que el modelo siempre
 * tenga los datos delante.
 */
export function jsonResult(summary: string, data: unknown): CallToolResult {
  return {
    content: [
      { type: "text", text: `${summary}\n\n${JSON.stringify(data, null, 2)}` },
    ],
    structuredContent: { data },
  };
}

/** Lista vacía: caso legítimo, no un error. Se dice explícitamente. */
export function emptyResult(what: string): CallToolResult {
  return textResult(
    `Sin resultados: no hay ${what}. No inventes datos para rellenar.`,
  );
}

/**
 * Resultado de error. `isError: true` le dice al cliente MCP que la tool falló
 * sin romper la sesión JSON-RPC: el modelo recibe el motivo y puede reaccionar
 * (reintentar, pedir otro input, avisar al usuario).
 */
export function errorResult(error: unknown): CallToolResult {
  const { kind, message } = describeError(error);
  return {
    isError: true,
    content: [{ type: "text", text: `[${kind}] ${message}` }],
  };
}
