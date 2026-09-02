import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Taller de tests unitarios (Fase 6.1). Sin jsdom ni Testing Library
// (decisión 6 de la sesión: esta sesión no testea componentes React).
export default defineConfig({
  test: {
    // Lógica pura y services: no hay DOM que simular.
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "mcp/**", "e2e/**", "**/.next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      // Solo la lógica que esta sesión testea (Fases 6.2 y 6.3): el resto
      // del árbol (app/, components/, hooks/ salvo su test puntual, mcp/)
      // queda fuera para que el reporte no diluya el % con código no
      // cubierto a propósito (decisión 6).
      include: ["lib/**", "services/**"],
      // services/test-utils/ es andamiaje de los tests (Fase 6.3), no código
      // de producción: contarlo inflaría el % de services/ con un archivo
      // escrito para estar cubierto.
      exclude: ["services/test-utils/**"],
    },
  },
  resolve: {
    alias: {
      // Mismo alias que tsconfig.json (paths: "@/*" -> "./*"): un test
      // importa "@/services/cart.service" igual que la app.
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
