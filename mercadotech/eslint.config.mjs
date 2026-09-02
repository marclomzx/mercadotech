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
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "mcp/dist/**", "coverage/**"],
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
