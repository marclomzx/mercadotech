import type { SourceType } from "@/services/embedding.service";

// Disparador de reindexado: fire-and-forget desde el navegador.
//
// REGLA ÚNICA de este módulo: jamás puede romper ni retrasar la operación
// principal. Publicar un producto es lo que le importa al vendedor; que su
// ficha se genere es un efecto secundario del sistema. Si Hugging Face está
// caído, si falta el token o si el endpoint devuelve 500, la publicación
// tiene que verse EXACTAMENTE igual que en la sesión 3.
//
// De ahí las tres decisiones de diseño:
//   1. No devuelve promesa útil ni se hace await en el camino del usuario.
//   2. Nunca lanza: todo error termina en console.warn.
//   3. No muestra toasts. El vendedor no tiene nada que hacer con "falló el
//      embedding", y un error rojo tras publicar con éxito confundiría.
//
// Este service NO conoce el cliente admin ni lib/ai: solo sabe hacer un POST.
// El trabajo real ocurre del otro lado, en app/api/v1/reindex.

export function triggerReindex(sourceType: SourceType, sourceId: string): void {
  // void + catch: se descarta la promesa a propósito. El llamador sigue de
  // largo sin esperar; si esto tardara 2 segundos en responder, al vendedor
  // no le afecta porque su redirect ya ocurrió.
  void fetch("/api/v1/reindex", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceType, sourceId }),
  })
    .then(async (response) => {
      if (response.ok) return;
      // Se lee el mensaje del endpoint para que el warn diga la causa real
      // (token, modelo rotado, cuota) y no solo el status.
      const body = await response.json().catch(() => null);
      const message = body?.error?.message ?? `HTTP ${response.status}`;
      console.warn(
        `[reindex] No se pudo indexar ${sourceType} ${sourceId}: ${message} ` +
          "· La publicación sí se guardó. Puedes regenerar las fichas con " +
          "`npx tsx scripts/index-all.ts`.",
      );
    })
    .catch((error) => {
      // Falla de red: ni siquiera se llegó al endpoint.
      console.warn(
        `[reindex] No se pudo contactar al endpoint de indexación para ` +
          `${sourceType} ${sourceId}: ${error instanceof Error ? error.message : error}`,
      );
    });
}
