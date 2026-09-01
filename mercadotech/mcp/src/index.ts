// LÍNEA 1 — stdout transporta JSON-RPC: la redirección de console a stderr
// tiene que estar aplicada ANTES de que se evalúe cualquier otro módulo (los
// `import` de ESM se hoistean, así que este import de efecto va primero y el
// resto después). El porqué completo, en el propio archivo.
import "./lib/stdout-guard.js";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadEnvLocal } from "./env.js";
import { createServer } from "./server.js";

/**
 * Entrada del servidor MCP de MercadoTech (transporte stdio).
 *
 *   npx tsx mcp/src/index.ts        # desde la RAÍZ del proyecto (decisión 7)
 *
 * Arranca en silencio: si todo va bien no escribe NADA — ni en stdout (sería
 * basura en el canal JSON-RPC) ni en stderr (ruido en el log del cliente). Se
 * queda esperando mensajes por stdin hasta que el cliente cierre el proceso.
 */
async function main(): Promise<void> {
  // Antes de nada: sin variables no hay clientes de Supabase que valgan, y es
  // mejor morir con un mensaje claro que aceptar la conexión y fallar en la
  // primera tool (lección 9 / decisión 2).
  loadEnvLocal();

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch((error) => {
  console.error(
    `[mercadotech-mcp] no arrancó: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
});
