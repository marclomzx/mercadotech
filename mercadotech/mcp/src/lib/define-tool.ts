import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { z, ZodObject, ZodRawShape } from "zod";

import { safeTool } from "./safe.js";

/**
 * Fábrica de tools: un archivo por tool, una línea en `tools/index.ts`.
 *
 * Hace TRES cosas por todas las tools, para que ninguna se pueda olvidar:
 *
 *  1. Envuelve el handler en `safeTool` (lección 7). Se aplica aquí y no a
 *     mano en cada archivo a propósito: envolver por construcción es lo que
 *     garantiza que ninguna excepción escape al transporte, y que la tool #11
 *     que alguien agregue el año que viene también quede cubierta.
 *  2. Marca todas las tools como `readOnlyHint`. El servidor MCP de
 *     MercadoTech es de SOLO LECTURA: ninguna tool inserta, actualiza ni
 *     borra nada, y el cliente merece saberlo antes de llamar.
 *  3. Convierte el `z.object(...)` en el raw shape que espera el SDK.
 */

/** Una tool ya definida, lista para engancharse al servidor. */
export type RegisteredToolDefinition = {
  name: string;
  register: (server: McpServer) => void;
};

export function defineTool<Shape extends ZodRawShape>(def: {
  name: string;
  /**
   * En español y empezando por QUÉ pregunta responde: es el único texto que
   * lee un modelo para decidir si esta es la tool que necesita.
   */
  description: string;
  inputSchema: ZodObject<Shape>;
  handler: (
    input: z.infer<ZodObject<Shape>>,
  ) => Promise<CallToolResult> | CallToolResult;
}): RegisteredToolDefinition {
  return {
    name: def.name,
    register(server: McpServer) {
      // El tipo del callback que declara el SDK (`ToolCallback<Args>`) es un
      // tipo condicional sobre `Args`; con `Shape` genérico TypeScript no
      // puede resolverlo y ninguna función le resulta asignable. Se acota la
      // firma de `registerTool` a la forma concreta que se usa aquí — el
      // único punto del servidor donde hace falta. La seguridad de tipos real
      // no se pierde: dentro de cada tool, `input` sigue siendo el
      // `z.infer<>` de su propio esquema.
      const registerTool = server.registerTool.bind(server) as unknown as (
        name: string,
        config: {
          description: string;
          inputSchema: ZodRawShape;
          annotations: ToolAnnotations;
        },
        cb: (input: unknown) => Promise<CallToolResult>,
      ) => unknown;

      registerTool(
        def.name,
        {
          description: def.description,
          inputSchema: def.inputSchema.shape,
          annotations: {
            // Solo lectura y mundo cerrado: todo sale de la base de datos de
            // MercadoTech (o del proveedor de IA sobre ese mismo contenido).
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: false,
          },
        },
        (input: unknown) =>
          safeTool(def.name, () =>
            def.handler(input as z.infer<ZodObject<Shape>>),
          ),
      );
    },
  };
}
