import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-response";
import { CHAT_QUERY_MAX_CHARS } from "@/lib/constants/ai";
import { createClient } from "@/lib/supabase/server";
import * as vectorSearchService from "@/services/vector-search.service";

// Segundo Route Handler del proyecto. Dos cosas importan de su diseño:
//
// 1. Requiere sesión (decisión 1 de la spec: la IA exige sesión iniciada).
//    No es solo una regla de negocio: knowledge_embeddings solo concede
//    SELECT a `authenticated`, así que un anónimo llamando a este endpoint
//    fallaría igual en el RPC — acá se corta antes, con un mensaje claro.
//
// 2. Usa el cliente de SESIÓN (createClient de lib/supabase/server), NO el
//    admin. searchProducts termina llamando al RPC match_knowledge, que es
//    SECURITY INVOKER: necesita las credenciales del usuario para que la
//    RLS de knowledge_embeddings se aplique de verdad, no solo de nombre.
//
// El embedding de la consulta se genera ACÁ, server-side: es la única forma
// de que el token de Hugging Face no viaje nunca al navegador.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError(
      401,
      "unauthorized",
      "Necesitas iniciar sesión para usar la búsqueda inteligente.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_json", "El cuerpo de la petición no es JSON válido.");
  }

  const { query } = (body ?? {}) as { query?: unknown };

  if (typeof query !== "string" || !query.trim()) {
    return apiError(400, "invalid_query", "La búsqueda no puede estar vacía.");
  }
  if (query.length > CHAT_QUERY_MAX_CHARS) {
    return apiError(
      400,
      "query_too_long",
      `La búsqueda no puede superar los ${CHAT_QUERY_MAX_CHARS} caracteres.`,
    );
  }

  try {
    const results = await vectorSearchService.searchProducts(query.trim(), {}, supabase);
    return NextResponse.json({ query, results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al buscar.";
    console.error(`[search/semantic] "${query}": ${message}`);
    // 502: igual que /reindex, el fallo casi siempre es del proveedor
    // externo (token, modelo, cuota), no del cliente que llamó al endpoint.
    return apiError(502, "search_failed", message);
  }
}
