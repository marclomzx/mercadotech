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
    return { kind: "internal", message: error.message };
  }
  // PostgREST propaga objetos planos con `message`; los services los dejan
  // pasar tal cual (convención del proyecto), así que llegan hasta aquí.
  if (typeof error === "object" && error !== null && "message" in error) {
    return { kind: "internal", message: String((error as { message: unknown }).message) };
  }
  return { kind: "internal", message: String(error) };
}
