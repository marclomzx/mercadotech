import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-response";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import * as embeddingService from "@/services/embedding.service";
import type { SourceType } from "@/services/embedding.service";

// PRIMER Route Handler del proyecto. Existe por la razón exacta que la
// sesión 2 reservó app/api/v1/: acá corre lo que NO puede correr en el
// navegador. Dos cosas server-only se juntan en este archivo:
//   1. El token de Hugging Face (lo usa embedding.service vía lib/ai).
//   2. El cliente ADMIN (service_role), porque knowledge_embeddings no
//      concede INSERT/UPDATE/DELETE ni a `authenticated`: solo el service
//      role escribe fichas. Si un usuario pudiera fabricarlas, podría
//      envenenar el contexto que después lee el modelo de lenguaje.

const SOURCE_TYPES: SourceType[] = ["producto", "articulo_soporte"];

export async function POST(request: Request) {
  // 1. Sesión primero: se corta antes de tocar el cliente admin o de gastar
  //    una llamada al proveedor. El endpoint no es público aunque el trigger
  //    lo llame desde el navegador del propio vendedor.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError(401, "unauthorized", "Necesitas iniciar sesión para reindexar contenido.");
  }

  // 2. Body válido.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_json", "El cuerpo de la petición no es JSON válido.");
  }

  const { sourceType, sourceId } = (body ?? {}) as {
    sourceType?: unknown;
    sourceId?: unknown;
  };

  if (typeof sourceType !== "string" || !SOURCE_TYPES.includes(sourceType as SourceType)) {
    return apiError(
      400,
      "invalid_source_type",
      `sourceType debe ser uno de: ${SOURCE_TYPES.join(", ")}.`,
    );
  }

  if (typeof sourceId !== "string" || !sourceId.trim()) {
    return apiError(400, "invalid_source_id", "sourceId es obligatorio.");
  }

  // 3. Recién acá el admin. indexSource resuelve solo los dos casos:
  //    si la fuente sigue visible la ficha; si ya no existe (producto
  //    borrado) o dejó de ser visible (pausado / despublicado), BORRA sus
  //    fichas — es la limpieza de huérfanos de la decisión 6, necesaria
  //    porque source_id no tiene foreign key.
  try {
    const admin = createAdminClient();
    const result = await embeddingService.indexSource(
      sourceType as SourceType,
      sourceId,
      admin,
    );

    return NextResponse.json({ sourceType, sourceId, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al reindexar.";

    // Se registra en el servidor porque el llamador es fire-and-forget y va a
    // descartar esta respuesta: sin este log, un fallo de indexación sería
    // completamente invisible.
    console.error(`[reindex] ${sourceType} ${sourceId}: ${message}`);

    // 502: el fallo casi siempre viene del proveedor externo (token, modelo
    // rotado, cuota), no de un error del cliente. El mensaje de lib/ai ya es
    // accionable y se propaga tal cual.
    return apiError(502, "indexing_failed", message);
  }
}
