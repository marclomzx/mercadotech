import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerPrompts } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";
import { registerTools } from "./tools/index.js";

/** Se mantiene a mano en sincronía con `mcp/package.json`. */
const SERVER_VERSION = "0.1.0";

/**
 * Construye el servidor MCP de MercadoTech.
 *
 * Fase 5.4: las 10 tools (5.3), los 7 resources y los 5 Prompts MCP (5.4)
 * quedan registrados. Ya no hacen falta los handlers provisionales de
 * listados vacíos de la 5.2/5.3: `registerResources`/`registerPrompts`
 * instalan sus propios `resources/list`, `resources/templates/list` y
 * `prompts/list` al registrar el primer resource/prompt de cada tipo (mismo
 * mecanismo que ya resolvió `tools/list` para las tools).
 */
export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: "mercadotech",
      version: SERVER_VERSION,
    },
    {
      // Se declaran las tres desde ya: es lo que el servidor va a ofrecer, y
      // permite que el Inspector muestre las tres pestañas en vez de un
      // "Method not found" (un cliente solo consulta lo que se le declara).
      capabilities: { tools: {}, resources: {}, prompts: {} },
      instructions:
        "Servidor de SOLO LECTURA del marketplace MercadoTech: catálogo, " +
        "categorías, reseñas y asistencia. Ninguna operación muta datos y " +
        "ninguna expone información privada de compradores.",
    },
  );

  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
}
