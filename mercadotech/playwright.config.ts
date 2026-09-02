import { defineConfig, devices } from "@playwright/test";

// E2E de MercadoTech (Fase 6.4). Requisito de entorno: corren SIEMPRE contra
// Supabase LOCAL con el seed cargado —
//   supabase start && supabase db reset
// — nunca contra el remoto. `supabase status -o json` da las credenciales
// que necesita la app (ver .env.local); en CI las pasa el job (decisión 11).
//
// Patrón de webServer (decisión 12, probado en ReadHub): en CI no hay nada
// corriendo, así que se construye para producción y se sirve ese build
// (paridad con lo que de verdad se despliega); en local se reutiliza el
// `npm run dev` si ya está arriba, para no perder el hot-reload del resto
// del trabajo.
const isCI = Boolean(process.env.CI);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e/tests",
  // Artefactos bajo e2e/ (no en la raíz): mismo lugar que el resto de la
  // infraestructura E2E, y lo que .gitignore excluye.
  outputDir: "./e2e/test-results",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI
    ? [["github"], ["html", { open: "never", outputFolder: "./e2e/playwright-report" }]]
    : [["html", { open: "never", outputFolder: "./e2e/playwright-report" }], ["list"]],

  // 10s en vez del default de 5s: las pantallas cargan datos reales contra
  // Supabase local (sin caché), y el primer request de cada navegador puede
  // tardar más que un mock — sobre todo webkit en frío.
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    // Solo en el fallo: un run verde no debe dejar artefactos pesados atrás.
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],

  webServer: {
    command: isCI ? "npm run build && npm run start" : "npm run dev",
    url: baseURL,
    // Local: si `npm run dev` ya está corriendo (lo normal mientras se
    // trabaja), lo reutiliza en vez de levantar un segundo servidor.
    reuseExistingServer: !isCI,
    timeout: isCI ? 180_000 : 60_000,
  },
});
