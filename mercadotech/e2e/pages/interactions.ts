import { expect, type Page } from "@playwright/test";

// Hallazgo real (no un capricho del test): un DropdownMenuItem que envuelve
// un <Link> de Next (base-ui Menu.Item con render={<Link/>}, closeOnClick
// por default) navega de forma INTERMITENTE bajo `next dev` — el cierre del
// menú y el click del <Link> compiten, y React StrictMode/Fast Refresh de
// dev alteran esa carrera. Verificado: contra `next build && next start`
// (lo que corre CI, Fase 6.7) navega al primer click, 100% de las veces, en
// varias corridas. No es un bug de producto — es ruido de dev-mode. Se
// reintenta el click hasta ver la URL cambiar, en vez de tocar el componente
// o aceptar un E2E local flaky.
export async function clickMenuLinkAndWaitForUrl(
  page: Page,
  click: () => Promise<void>,
  urlPattern: RegExp,
  timeout = 15_000,
) {
  await expect(async () => {
    await click();
    await expect(page).toHaveURL(urlPattern, { timeout: 1500 });
  }).toPass({ timeout });
}
