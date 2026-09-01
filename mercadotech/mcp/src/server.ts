import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ListPromptsRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

/** Se mantiene a mano en sincronía con `mcp/package.json`. */
const SERVER_VERSION = "0.1.0";

/**
 * Construye el servidor MCP de MercadoTech.
 *
 * En la Fase 5.2 arranca VACÍO a propósito: declara sus tres capabilities y
 * responde a los tres listados con listas vacías. Las tools llegan en la 5.3;
 * los resources y prompts, en la 5.4.
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

  registerEmptyListings(server);

  return server;
}

/**
 * Handlers provisionales de los tres listados, para que el servidor vacío
 * responda `[]` en vez de `Method not found`.
 *
 * ⚠️ BORRAR EN LAS FASES 5.3 / 5.4. `McpServer.registerTool()` llama a
 * `assertCanSetRequestHandler("tools/list")` y LANZA si ya hay un handler
 * puesto a mano; lo mismo vale para `registerResource` y `registerPrompt` con
 * sus métodos. En cuanto exista la primera tool, esta función sobra: el propio
 * `McpServer` instala los listados reales.
 */
function registerEmptyListings(server: McpServer): void {
  const low = server.server;

  low.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }));
  low.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
  low.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [],
  }));
  low.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));
}
