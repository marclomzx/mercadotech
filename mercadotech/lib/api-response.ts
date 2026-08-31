import { NextResponse } from "next/server";

// Respuestas de error consistentes para los Route Handlers de la sesión 4.
//
// Los tres endpoints (/reindex, /search/semantic, /chat) devuelven la MISMA
// forma, para que el cliente pueda leer siempre `error.message` sin adivinar.
// El `code` es estable y legible por máquina; el `message` va en español
// porque puede terminar mostrándose al usuario.

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message } }, { status });
}
