// stdout transporta JSON-RPC: cualquier log va a stderr o corrompe la sesión.
console.log = console.info = console.warn = (...a) => console.error(...a);

/**
 * ¿Por qué un módulo aparte y no dos líneas dentro de `index.ts`?
 *
 * Porque en ESM los `import` se HOISTEAN: se resuelven y evalúan antes que
 * cualquier sentencia del archivo que los declara. Una asignación escrita en
 * la línea 1 de `index.ts` correría DESPUÉS de que se hayan ejecutado el SDK,
 * `services/*` y `lib/ai/*` — justo los módulos cuyo `console.log` transitivo
 * queremos interceptar (lección 3).
 *
 * Un import de efecto secundario sí respeta el orden: los módulos se evalúan
 * en el orden en que aparecen los imports. Poniendo ESTE import primero en
 * `index.ts`, la redirección ya está aplicada cuando se evalúa el segundo.
 *
 * Este archivo es el ÚNICO de `mcp/src/` que toca `console`. Del resto del
 * servidor: nada de `console.log` — los diagnósticos van por `console.error`.
 */
export {};
