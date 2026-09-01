import { defineConfig } from "tsup";

/**
 * Build del servidor MCP a `dist/`.
 *
 * El alias `@/*` NO se declara aquí a mano: esbuild lee los `paths` de
 * `mcp/tsconfig.json` (`@/*` → `../*`), que es la única definición del alias
 * (decisión 7). Un segundo mapeo aquí sería una fuente de verdad duplicada que
 * se desincroniza en cuanto alguien toque el tsconfig.
 *
 * Los archivos del proyecto que entran por el alias (`services/`, `lib/ai/`,
 * `lib/constants/`, `types/`) resuelven a rutas relativas, así que quedan
 * BUNDLEADOS dentro de dist/index.js. Las dependencias de node_modules siguen
 * siendo externas (comportamiento por defecto de tsup): `dist/` necesita el
 * node_modules del proyecto para correr, igual que `src/`.
 */
export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  tsconfig: "tsconfig.json",
  format: ["esm"],
  platform: "node",
  target: "node20",
  sourcemap: true,
  clean: true,
  // Un solo archivo: el binario que lanza el cliente MCP por stdio.
  splitting: false,
  dts: false,
});
