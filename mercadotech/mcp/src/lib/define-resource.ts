import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult, Resource } from "@modelcontextprotocol/sdk/types.js";

import { safeResource, safeValue } from "./safe.js";

/**
 * Fábricas de resources: un archivo por resource, una línea en
 * `resources/index.ts` — mismo patrón que `define-tool.ts` para las tools.
 *
 * Hacen lo que pide la lección 7 POR CONSTRUCCIÓN, para que ningún resource
 * nuevo se olvide de envolverse:
 *
 *  1. `defineResource` (URI fija): el `read` pasa por `safeResource`, así que
 *     una fuente caída nunca lanza — devuelve su error como contenido.
 *  2. `defineResourceTemplate` (URI con variables): además del `read`, el
 *     callback `list` —el que `resources/list` invoca para enumerar las
 *     instancias reales— pasa por `safeValue` con `{ resources: [] }` de
 *     fallback. Es la pieza concreta que hace que `resources/list` NUNCA
 *     falle completo: si Supabase está caído, este template simplemente no
 *     aporta instancias, y el resto del listado sigue en pie.
 */

export type RegisteredResourceDefinition = {
  name: string;
  register: (server: McpServer) => void;
};

export function defineResource(def: {
  name: string;
  uri: string;
  title: string;
  description: string;
  mimeType?: string;
  read: (uri: URL) => Promise<ReadResourceResult> | ReadResourceResult;
}): RegisteredResourceDefinition {
  return {
    name: def.name,
    register(server: McpServer) {
      server.registerResource(
        def.name,
        def.uri,
        {
          title: def.title,
          description: def.description,
          mimeType: def.mimeType ?? "application/json",
        },
        (uri) => safeResource(def.name, uri.href, () => def.read(uri)),
      );
    },
  };
}

export function defineResourceTemplate(def: {
  name: string;
  uriTemplate: string;
  title: string;
  description: string;
  mimeType?: string;
  /** Enumera las instancias reales para `resources/list` (lección 7: envuelto en `safeValue`). */
  list: () => Promise<{ resources: Resource[] }> | { resources: Resource[] };
  read: (
    uri: URL,
    variables: Record<string, string | string[]>,
  ) => Promise<ReadResourceResult> | ReadResourceResult;
}): RegisteredResourceDefinition {
  return {
    name: def.name,
    register(server: McpServer) {
      const template = new ResourceTemplate(def.uriTemplate, {
        list: () => safeValue(`${def.name} (list)`, def.list, { resources: [] }),
      });

      server.registerResource(
        def.name,
        template,
        {
          title: def.title,
          description: def.description,
          mimeType: def.mimeType ?? "application/json",
        },
        (uri, variables) =>
          safeResource(def.name, uri.href, () => def.read(uri, variables)),
      );
    },
  };
}
