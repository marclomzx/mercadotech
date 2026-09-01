import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

import { describeError } from "./errors.js";
import { errorResult } from "./tool-result.js";

/**
 * Wrapper try/catch uniforme: TODA tool y TODO resource pasa por aquí.
 *
 * Motivo (lección 7): una excepción que escapa del handler se propaga por el
 * transporte y puede tumbar la sesión entera; y `resources/list` no puede
 * fallar completo porque una sola fuente esté caída. Aquí el fallo se
 * convierte en dato: se registra en stderr (donde sí podemos escribir) y se
 * devuelve algo útil.
 */

/**
 * Envuelve el handler de una tool. Nunca lanza: un fallo vuelve como
 * `CallToolResult` con `isError: true`.
 */
export async function safeTool(
  label: string,
  handler: () => Promise<CallToolResult> | CallToolResult,
): Promise<CallToolResult> {
  try {
    return await handler();
  } catch (error) {
    logFailure(label, error);
    return errorResult(error);
  }
}

/**
 * Envuelve cualquier operación que deba degradar en vez de fallar: cada
 * resource del listado se calcula con esto, así que uno roto devuelve su
 * `fallback` y el resto del listado sigue en pie.
 */
export async function safeValue<T>(
  label: string,
  operation: () => Promise<T> | T,
  fallback: T,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logFailure(label, error);
    return fallback;
  }
}

/**
 * Envuelve el `read` de UN resource (fijo o instancia de un template).
 *
 * Distinto de `safeTool`: `ReadResourceResult` no tiene un campo `isError`
 * como `CallToolResult`, así que un fallo capturado no puede "marcarse" —
 * se devuelve como contenido de texto legible en el mismo `uri` que se pidió.
 * Esto es lo que hace que un `resources/read` sobre una fuente caída
 * degrade (lección 7) en vez de propagar el error crudo por el transporte.
 */
export async function safeResource(
  label: string,
  uri: string,
  handler: () => Promise<ReadResourceResult> | ReadResourceResult,
): Promise<ReadResourceResult> {
  try {
    return await handler();
  } catch (error) {
    logFailure(label, error);
    const { kind, message } = describeError(error);
    return {
      contents: [{ uri, mimeType: "text/plain", text: `[${kind}] ${message}` }],
    };
  }
}

/**
 * Traza de diagnóstico. Va por `console.error` — el único canal de log
 * disponible: stdout está reservado para el JSON-RPC del transporte stdio
 * (ver `src/lib/stdout-guard.ts`).
 */
function logFailure(label: string, error: unknown): void {
  const { kind, message } = describeError(error);
  console.error(`[mercadotech-mcp] ${label} falló (${kind}): ${message}`);
  if (error instanceof Error && error.stack) console.error(error.stack);
}
