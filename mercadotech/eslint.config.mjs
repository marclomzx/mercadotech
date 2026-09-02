import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // "mcp/dist/**": salida de `npm run build` en mcp/ (Fase 5.5) — es el
    // bundle de tsup con el SDK de MCP incluido, no código propio; sin este
    // ignore, `npm run lint` en la raíz falla apenas alguien construye el
    // servidor MCP.
    // "coverage/**": reporte HTML de `npm run test:coverage` (Fase 6.1) —
    // mismo motivo: es salida generada, no código propio.
    // "e2e/playwright-report/**" y "e2e/test-results/**": artefactos de
    // `npm run test:e2e` (Fase 7.2). El reporte trae el bundle minificado del
    // visor de trazas de Playwright: sin este ignore, correr los E2E y después
    // `npm run lint` da cientos de errores de código ajeno — y el validator de
    // la Fase 6.8 dictaría FALLIDA por algo que no es del proyecto.
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "mcp/dist/**",
      "coverage/**",
      "e2e/playwright-report/**",
      "e2e/test-results/**",
    ],
  },
  {
    // e2e/ no es código React: el fixture de Playwright (Fase 6.4) recibe un
    // parámetro llamado `use` por convención de su propia API — no tiene
    // relación con React. react-hooks lo confunde con un Hook por el nombre.
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
];

export default eslintConfig;
