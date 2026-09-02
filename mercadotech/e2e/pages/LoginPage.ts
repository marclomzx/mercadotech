import type { Page } from "@playwright/test";

import type { TestUser } from "@/e2e/data/users";

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/login");
  }

  async login(user: TestUser) {
    await this.page.goto("/login");
    await this.page.getByTestId("login-email").fill(user.email);
    await this.page.getByTestId("login-password").fill(user.password);
    await this.page.getByTestId("login-submit").click();
    // El menú de usuario solo aparece con la sesión ya escrita — esperarlo
    // es la señal real de que el login terminó, no un timeout a ciegas.
    await this.page.getByTestId("user-menu").waitFor();
  }
}
