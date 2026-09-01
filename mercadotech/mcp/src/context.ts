import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Fábrica de clientes de Supabase para el servidor MCP.
 *
 * ── Por qué NO importa `lib/supabase/admin.ts` (ni `lib/supabase/client.ts`) ──
 *
 * 1. Regla de capas de la sesión 5: `mcp/` solo importa de `services/`,
 *    `lib/ai/`, `lib/constants/` y `types/`. `lib/supabase/` queda fuera a
 *    propósito — sus clientes están afinados para los entornos de Next
 *    (navegador, Route Handler, middleware), no para un proceso stdio.
 * 2. El anon de la web es `createBrowserClient` de `@supabase/ssr`: guarda la
 *    sesión en cookies del documento. Bajo Node no hay documento; construir
 *    solo la mitad admin desde `lib/` partiría la fábrica en dos mecanismos.
 * 3. El precedente exacto está en `scripts/index-all.ts`, el otro proceso Node
 *    puro de este repo: su cabecera documenta que Node 20 no expone `WebSocket`
 *    global y que `supabase-js` LANZA al construir el cliente si no lo
 *    encuentra, aunque solo se vayan a hacer llamadas REST. Quien construye el
 *    cliente tiene que resolver ese stub, así que lo construimos aquí (misma
 *    solución, mismo archivo que la usa).
 *
 * Es la decisión 1 de la sesión 5: `src/context.ts` arma sus clientes con
 * `@supabase/supabase-js` directamente, con el patrón de `index-all.ts`.
 */

// Stub de WebSocket: copiado del criterio de scripts/index-all.ts. Este
// servidor no usa realtime en ninguna tool, así que basta con satisfacer la
// comprobación de supabase-js y fallar ruidosamente si alguien se suscribiera
// de verdad. La alternativa sería exigir Node 22+ o sumar la dependencia `ws`.
if (typeof globalThis.WebSocket === "undefined") {
  class UnsupportedWebSocket {
    constructor() {
      throw new Error(
        "El servidor MCP de MercadoTech no usa realtime. Si necesitas " +
          "suscripciones, corre con Node 22+ (que trae WebSocket nativo).",
      );
    }
  }
  (globalThis as { WebSocket?: unknown }).WebSocket = UnsupportedWebSocket;
}

export type Client = SupabaseClient<Database>;

export interface McpContext {
  /**
   * Cliente público: respeta Row Level Security. Es el DEFECTO de toda tool y
   * resource — solo ve lo que vería un visitante anónimo del sitio.
   */
  anon: Client;
  /**
   * Cliente de servicio: BYPASEA RLS por completo. Se usa SOLO donde la tabla
   * de las Fases 5.3/5.4 lo marca (knowledge_embeddings, orders, profiles), con
   * el porqué en un comentario junto al registro. Nunca "admin por comodidad",
   * y nunca para exponer datos privados de un comprador.
   */
  admin: Client;
}

const CLIENT_OPTIONS = {
  // Proceso sin usuario ni navegador: no hay sesión que persistir ni token que
  // refrescar. Mismo criterio que lib/supabase/admin.ts en la web.
  auth: { autoRefreshToken: false, persistSession: false },
} as const;

/**
 * Crea un contexto NUEVO para cada invocación (lección 5).
 *
 * No es un singleton de arranque a propósito: el servidor MCP puede quedar
 * vivo horas colgado del stdio de su cliente, y un par de clientes construidos
 * al iniciar congelaría las credenciales de ese instante. Construir un cliente
 * de supabase-js es barato (no abre conexión: cada consulta es un fetch REST),
 * así que el costo por llamada es despreciable frente al de quedarse con
 * credenciales viejas.
 *
 * Precondición: `loadEnvLocal()` ya corrió (lo hace `src/index.ts` al arrancar
 * y valida que las variables existan), por eso aquí el `!` es seguro.
 */
export function createContext(): McpContext {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return {
    anon: createClient<Database>(
      url,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      CLIENT_OPTIONS,
    ),
    admin: createClient<Database>(
      url,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      CLIENT_OPTIONS,
    ),
  };
}
