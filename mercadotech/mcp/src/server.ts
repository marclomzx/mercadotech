import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ListPromptsRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { registerTools } from "./tools/index.js";

/** Se mantiene a mano en sincronía con `mcp/package.json`. */
const SERVER_VERSION = "0.1.0";

/**
 * Construye el servidor MCP de MercadoTech.
 *
 * Fase 5.3: las 10 tools de solo lectura ya están registradas. Los resources
 * y prompts llegan en la 5.4 — hasta entonces responden con listas vacías.
 */
export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: "mercadotech",
      version: SERVER_VERSION,
    },
    {
      // Se declaran las tres desde ya: es lo que el servidor va a ofrecer, y
      // permite que el Inspector muestre las tres pestañas en 0 en vez de un
      // "Method not found" (un cliente solo consulta lo que se le declara).
      capabilities: { tools: {}, resources: {}, prompts: {} },
      instructions:
        "Servidor de SOLO LECTURA del marketplace MercadoTech: catálogo, " +
        "categorías, reseñas y asistencia. Ninguna operación muta datos y " +
        "ninguna expone información privada de compradores.",
    },
  );

  registerTools(server);
  registerEmptyListings(server);

  return server;
}

/**
 * Handlers provisionales de los listados que TODAVÍA no tienen contenido, para
 * que respondan `[]` en vez de `Method not found`.
 *
 * El de `tools/list` ya se fue en esta fase: lo instala `McpServer` al
 * registrar la primera tool. Los otros dos se van en la 5.4 por la misma razón.
 *
 * ⚠️ BORRAR EN LA FASE 5.4. `McpServer.registerResource()` llama a
 * `assertCanSetRequestHandler("resources/list")` y LANZA si ya hay un handler
 * puesto a mano; lo mismo vale para `registerPrompt`. Se registran DESPUÉS de
 * `registerTools` por el mismo motivo, en orden.
 */
function registerEmptyListings(server: McpServer): void {
  const low = server.server;

  low.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
  low.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [],
  }));
  low.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));
}
