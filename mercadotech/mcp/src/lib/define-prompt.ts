import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import type { z, ZodObject, ZodRawShape } from "zod";

import { describeError } from "./errors.js";

/**
 * Fábrica de Prompts MCP — recordatorio de la lección 2: un Prompt MCP vive
 * en el servidor y lo ofrece el protocolo; no es una Skill de Claude Code.
 *
 * Un archivo por prompt, una línea en `prompts/index.ts` (mismo patrón que
 * `define-tool.ts`/`define-resource.ts`). A diferencia de una tool, el SDK
 * SÍ atrapa cualquier excepción de `prompts/get` y la convierte en un error
 * JSON-RPC por su cuenta (no hace falta un `isError` como en
 * `CallToolResult`) — pero un error crudo de PostgREST igual llegaría al
 * cliente sin traducir. Por eso el catch de aquí solo NORMALIZA el mensaje
 * con `describeError` (mismo texto accionable que usan tools y resources) y
 * lo deja subir; nunca inventa contenido para una consulta que falló.
 *
 * Los argumentos de un Prompt MCP viajan SIEMPRE como string (así lo exige
 * el protocolo: `prompts/get` manda `arguments: Record<string, string>`) —
 * por eso cada `argsSchema` de esta sesión usa `z.string()`, nunca `z.number()`
 * ni `z.array()`; una lista como `ids` se recibe como string y se separa a
 * mano dentro del handler.
 */

export type RegisteredPromptDefinition = {
  name: string;
  register: (server: McpServer) => void;
};

export function definePrompt<Shape extends ZodRawShape>(def: {
  name: string;
  description: string;
  argsSchema: ZodObject<Shape>;
  handler: (input: z.infer<ZodObject<Shape>>) => Promise<GetPromptResult> | GetPromptResult;
}): RegisteredPromptDefinition {
  return {
    name: def.name,
    register(server: McpServer) {
      // Mismo motivo que en `define-tool.ts`: el tipo condicional que declara
      // el SDK sobre `Args extends PromptArgsRawShape` no lo puede resolver
      // TypeScript con `Shape` genérico. Se acota la firma al único uso real
      // de este archivo; dentro de cada prompt, `input` sigue siendo el
      // `z.infer<>` exacto de su propio esquema.
      const registerPrompt = server.registerPrompt.bind(server) as unknown as (
        name: string,
        config: { description: string; argsSchema: ZodRawShape },
        cb: (input: unknown) => Promise<GetPromptResult>,
      ) => unknown;

      registerPrompt(
        def.name,
        { description: def.description, argsSchema: def.argsSchema.shape },
        async (input: unknown) => {
          try {
            return await def.handler(input as z.infer<ZodObject<Shape>>);
          } catch (error) {
            const { kind, message } = describeError(error);
            console.error(`[mercadotech-mcp] ${def.name} falló (${kind}): ${message}`);
            throw new Error(`[${kind}] ${message}`);
          }
        },
      );
    },
  };
}
