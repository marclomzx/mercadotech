/**
 * Errores tipados del servidor MCP.
 *
 * El cliente MCP no ve stack traces: ve el texto que devuelve la tool. Por eso
 * los fallos previsibles se modelan con una clase propia y un `kind` estable,
 * en vez de dejar escapar el error crudo de PostgREST o de Hugging Face (que
 * además puede filtrar detalles de la infraestructura).
 */

export type McpErrorKind =
  /** El recurso pedido no existe o no es visible con el cliente usado. */
  | "not_found"
  /** El input no pasó la validación de zod o es incoherente. */
  | "invalid_input"
  /** Supabase o Hugging Face no respondieron / respondieron con error. */
  | "provider_down"
  /** Cualquier otra cosa: un bug nuestro. */
  | "internal";

export class McpToolError extends Error {
  readonly kind: McpErrorKind;
  /** Contexto extra para el stderr; NO se le muestra al modelo. */
  readonly cause?: unknown;

  constructor(kind: McpErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = "McpToolError";
    this.kind = kind;
    this.cause = cause;
  }
}

export const notFound = (what: string, cause?: unknown) =>
  new McpToolError("not_found", `No se encontró ${what}.`, cause);

export const invalidInput = (detail: string, cause?: unknown) =>
  new McpToolError("invalid_input", `Input inválido: ${detail}`, cause);

export const providerDown = (provider: string, cause?: unknown) =>
  new McpToolError(
    "provider_down",
    `${provider} no está respondiendo. Reintenta en unos segundos.`,
    cause,
  );

/**
 * ¿El mensaje viene del proveedor de IA?
 *
 * HEURÍSTICA POR MENSAJE, y a propósito. Los errores de `lib/ai/` son
 * `Error` normales (esa capa es del proyecto web y no conoce a `McpToolError`),
 * y en dos de las cuatro tools de IA la llamada al proveedor está ENTERRADA
 * dentro de un service que además consulta Supabase: `chat.service.ask` y
 * `vector-search.searchProducts` mezclan embedding y base de datos en la misma
 * llamada, así que envolver la llamada entera etiquetaría como "proveedor
 * caído" un fallo de Postgres.
 *
 * Mirar el mensaje es lo único que distingue una causa de la otra sin tocar
 * `lib/ai/`. Solo afecta a la ETIQUETA (`kind`): el texto accionable que
 * escribió `lib/ai/` llega al modelo intacto en los dos casos.
 */
function looksLikeAiProviderFailure(message: string): boolean {
  return /hugging\s?face|HUGGINGFACEHUB_API_TOKEN|HUGGINGFACE_(CHAT|EMBEDDING)_MODEL/i.test(
    message,
  );
}

/**
 * Normaliza cualquier cosa lanzada (Error, error de PostgREST, string, objeto
 * suelto) a un `{kind, message}` presentable. Es el único punto donde un error
 * ajeno se convierte en texto para el modelo.
 */
export function describeError(error: unknown): {
  kind: McpErrorKind;
  message: string;
} {
  if (error instanceof McpToolError) {
    return { kind: error.kind, message: error.message };
  }
  if (error instanceof Error) {
    return {
      kind: looksLikeAiProviderFailure(error.message) ? "provider_down" : "internal",
      message: error.message,
    };
  }
  // PostgREST propaga objetos planos con `message`; los services los dejan
  // pasar tal cual (convención del proyecto), así que llegan hasta aquí.
  if (typeof error === "object" && error !== null && "message" in error) {
    return { kind: "internal", message: String((error as { message: unknown }).message) };
  }
  return { kind: "internal", message: String(error) };
}
