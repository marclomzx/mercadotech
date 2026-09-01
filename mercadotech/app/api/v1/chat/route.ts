import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-response";
import { CHAT_QUERY_MAX_CHARS } from "@/lib/constants/ai";
import { createClient } from "@/lib/supabase/server";
import * as chatService from "@/services/chat.service";
import type { ChatMode } from "@/types/chat";

const MODES: ChatMode[] = ["compras", "soporte"];

export async function POST(request: Request) {
  // 1. Sesión obligatoria (decisión 1: la IA exige sesión). Se corta antes de
  //    gastar una llamada al proveedor.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError(401, "unauthorized", "Necesitas iniciar sesión para usar el asistente.");
  }

  // 2. Body sintácticamente válido → 400.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_json", "El cuerpo de la petición no es JSON válido.");
  }

  const { query, mode } = (body ?? {}) as { query?: unknown; mode?: unknown };

  if (typeof query !== "string" || !query.trim()) {
    return apiError(400, "invalid_query", "La consulta no puede estar vacía.");
  }
  if (query.length > CHAT_QUERY_MAX_CHARS) {
    return apiError(
      400,
      "query_too_long",
      `La consulta no puede superar los ${CHAT_QUERY_MAX_CHARS} caracteres.`,
    );
  }

  // 3. `mode` es 422 y no 400: el cuerpo está bien formado, lo que no es
  //    procesable es el VALOR — distinguirlo le dice al cliente si el
  //    problema es cómo mandó los datos o qué mandó.
  if (typeof mode !== "string" || !MODES.includes(mode as ChatMode)) {
    return apiError(
      422,
      "invalid_mode",
      `mode debe ser uno de: ${MODES.join(", ")}.`,
    );
  }

  try {
    // Cliente de SESIÓN, no admin: la búsqueda tiene que pasar por la RLS de
    // knowledge_embeddings con las credenciales de quien pregunta.
    const result = await chatService.ask(query.trim(), mode as ChatMode, {}, supabase);

    // Log estructurado, una línea por consulta. Es el insumo con el que la
    // Fase 4.8 decide si el umbral 0.3 se queda o se mueve: si consultas
    // legítimas traen usedSourceCount 0, hay que bajarlo; si entra ruido,
    // subirlo.
    console.log(
      JSON.stringify({
        endpoint: "chat",
        mode,
        retrievedCount: result.metadata.retrievedCount,
        usedSourceCount: result.metadata.usedSourceCount,
        hasRelevantContext: result.hasRelevantContext,
        model: result.metadata.model,
      }),
    );

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al responder la consulta.";
    // Sin el texto de la consulta: mismo criterio que el log de éxito de
    // arriba, que tampoco lo incluye.
    console.error(`[chat] mode=${mode}: ${message}`);
    // 502: igual que los otros dos endpoints, el fallo casi siempre viene del
    // proveedor externo (token, modelo rotado, cuota). El mensaje de lib/ai ya
    // es accionable y se propaga tal cual.
    return apiError(502, "chat_failed", message);
  }
}
