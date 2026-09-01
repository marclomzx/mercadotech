import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Carga de variables de entorno para el servidor MCP.
 *
 * Un proceso Node no lee `.env.local` solo — eso lo hace Next (lección 9).
 * `scripts/index-all.ts` ya resolvió esto con un parseo manual; aquí se
 * reutiliza el MISMO patrón sobre la MISMA `.env.local` de la RAÍZ del
 * proyecto: una sola fuente de credenciales, sin un `.env` propio en `mcp/`
 * que se desincronice o duplique la service role key (decisión 2).
 *
 * Única diferencia con `index-all.ts`: aquel resuelve la ruta con
 * `process.cwd()` porque está documentado que se corre desde la raíz. El MCP
 * no puede: lo lanza un cliente (Claude Code, el Inspector) que fija el cwd a
 * lo que se le antoje. Por eso la ruta se busca desde la ubicación de ESTE
 * módulo hacia arriba.
 */

/** Variables sin las cuales el servidor no puede atender NI UNA sola tool. */
const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

/**
 * Variables que habilitan PARTE del servidor. Su ausencia se avisa por stderr
 * pero NO impide arrancar.
 *
 * `HUGGINGFACEHUB_API_TOKEN` lo consumen `lib/ai/embeddings.ts` y
 * `lib/ai/completion.ts`, de los que dependen 4 de las 10 tools
 * (semantic_search_products, ask_assistant, find_related_products,
 * summarize_reviews). Sin él, esas cuatro devuelven el error accionable de
 * `lib/ai/` como error de tool y las otras seis siguen funcionando con
 * normalidad — que es exactamente la degradación que pide la Fase 5.3. Si
 * fuera obligatorio aquí, la falta de un token de IA tumbaría también la
 * búsqueda por texto y la consulta de pedidos, que no tienen nada que ver.
 */
const OPTIONAL = ["HUGGINGFACEHUB_API_TOKEN"] as const;

/** Sube desde `mcp/src/` (o `mcp/dist/`) buscando la `.env.local` de la raíz. */
function findEnvLocal(): string | null {
  let dir = dirname(fileURLToPath(import.meta.url));
  // Tope de 5 niveles: alcanza de sobra para mcp/src/ y mcp/dist/, y evita
  // salirse del proyecto y tomar la .env.local de otro repo vecino.
  for (let depth = 0; depth < 5; depth += 1) {
    const candidate = resolve(dir, ".env.local");
    try {
      readFileSync(candidate, "utf8");
      return candidate;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

/**
 * Parsea la `.env.local` de la raíz y valida que estén las variables
 * requeridas. Lanza con un mensaje accionable si falta algo: el cliente MCP
 * solo ve el stderr del proceso hijo, así que un fallo mudo aquí se ve como
 * "el servidor no conecta" y no hay forma de diagnosticarlo.
 */
export function loadEnvLocal(): void {
  const path = findEnvLocal();
  if (path === null) {
    throw new Error(
      "No se encontró .env.local en la raíz del proyecto. " +
        "Copia .env.example a .env.local y complétalo " +
        "(los valores locales salen de `supabase status -o env`).",
    );
  }

  const contents = readFileSync(path, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    // El entorno del proceso GANA sobre el archivo: así el cliente MCP puede
    // sobrescribir una variable desde `.mcp.json` (Fase 5.5) sin editar nada.
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }

  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Faltan variables en ${path}: ${missing.join(", ")}. ` +
        "El servidor MCP no puede arrancar sin ellas (ver .env.example).",
    );
  }

  const degraded = OPTIONAL.filter((name) => !process.env[name]);
  if (degraded.length > 0) {
    // Por stderr, nunca por stdout (ver src/lib/stdout-guard.ts).
    console.error(
      `[mercadotech-mcp] ${degraded.join(", ")} no está configurada en ${path}: ` +
        "las tools que usan IA (semantic_search_products, ask_assistant, " +
        "find_related_products, summarize_reviews) devolverán error; el resto " +
        "del servidor funciona con normalidad.",
    );
  }
}
