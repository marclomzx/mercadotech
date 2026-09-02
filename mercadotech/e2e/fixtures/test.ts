import { test as base } from "@playwright/test";

import type { TestUser } from "@/e2e/data/users";
import { LoginPage } from "@/e2e/pages/LoginPage";

// Sesión por test, sin estado compartido entre specs (decisión de la Fase
// 6.4): cada test que necesita un usuario logueado llama a `loginAs`, que
// hace el login real por UI en SU PROPIA página — nada de storageState
// compartido entre specs, que dejaría un test dependiendo del orden de
// ejecución de otro.
type Fixtures = {
  loginAs: (user: TestUser) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  loginAs: async ({ page }, use) => {
    await use(async (user: TestUser) => {
      const loginPage = new LoginPage(page);
      await loginPage.login(user);
    });
  },
});

export { expect } from "@playwright/test";
