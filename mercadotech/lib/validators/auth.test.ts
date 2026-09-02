import { describe, expect, it } from "vitest";

import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  PASSWORD_MIN_LENGTH,
  REGISTRABLE_ROLES,
  isValid,
  validateLogin,
  validateRegister,
  type RegisterInput,
} from "@/lib/validators/auth";

const validRegisterInput: RegisterInput = {
  email: "buyer1@mercadotech.test",
  password: "a".repeat(PASSWORD_MIN_LENGTH),
  displayName: "a".repeat(DISPLAY_NAME_MIN_LENGTH),
  role: "buyer",
};

describe("validateLogin", () => {
  it("rechaza email vacío", () => {
    const errors = validateLogin({ email: "  ", password: "x" });
    expect(errors.email).toBe("Ingresa tu correo.");
  });

  it("rechaza un email sin formato válido", () => {
    const errors = validateLogin({ email: "no-es-un-correo", password: "x" });
    expect(errors.email).toBe("Ingresa un correo válido.");
  });

  it("rechaza password vacío", () => {
    const errors = validateLogin({ email: "a@b.com", password: "" });
    expect(errors.password).toBe("Ingresa tu contraseña.");
  });

  it("caso feliz: email y password válidos no producen errores", () => {
    const errors = validateLogin({ email: "a@b.com", password: "x" });
    expect(isValid(errors)).toBe(true);
  });
});

describe("validateRegister — email", () => {
  it("rechaza email vacío", () => {
    const errors = validateRegister({ ...validRegisterInput, email: "  " });
    expect(errors.email).toBe("Ingresa tu correo.");
  });

  it("rechaza un email sin formato válido", () => {
    const errors = validateRegister({ ...validRegisterInput, email: "no-es-un-correo" });
    expect(errors.email).toBe("Ingresa un correo válido.");
  });

  it("acepta un email válido", () => {
    const errors = validateRegister(validRegisterInput);
    expect(errors.email).toBeUndefined();
  });
});

describe("validateRegister — password", () => {
  it("rechaza password vacío", () => {
    const errors = validateRegister({ ...validRegisterInput, password: "" });
    expect(errors.password).toBe("Ingresa una contraseña.");
  });

  it(`rechaza password de ${PASSWORD_MIN_LENGTH - 1} caracteres y acepta uno de ${PASSWORD_MIN_LENGTH}`, () => {
    const short = validateRegister({
      ...validRegisterInput,
      password: "a".repeat(PASSWORD_MIN_LENGTH - 1),
    });
    expect(short.password).toBe(
      `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    );

    const exact = validateRegister({
      ...validRegisterInput,
      password: "a".repeat(PASSWORD_MIN_LENGTH),
    });
    expect(exact.password).toBeUndefined();
  });
});

describe("validateRegister — displayName", () => {
  it(`rechaza displayName de ${DISPLAY_NAME_MIN_LENGTH - 1} caracteres y acepta uno de ${DISPLAY_NAME_MIN_LENGTH}`, () => {
    const short = validateRegister({
      ...validRegisterInput,
      displayName: "a".repeat(DISPLAY_NAME_MIN_LENGTH - 1),
    });
    expect(short.displayName).toBe(
      `El nombre debe tener al menos ${DISPLAY_NAME_MIN_LENGTH} caracteres.`,
    );

    const exact = validateRegister({
      ...validRegisterInput,
      displayName: "a".repeat(DISPLAY_NAME_MIN_LENGTH),
    });
    expect(exact.displayName).toBeUndefined();
  });

  it(`acepta displayName de ${DISPLAY_NAME_MAX_LENGTH} caracteres y rechaza uno de ${DISPLAY_NAME_MAX_LENGTH + 1}`, () => {
    const exact = validateRegister({
      ...validRegisterInput,
      displayName: "a".repeat(DISPLAY_NAME_MAX_LENGTH),
    });
    expect(exact.displayName).toBeUndefined();

    const long = validateRegister({
      ...validRegisterInput,
      displayName: "a".repeat(DISPLAY_NAME_MAX_LENGTH + 1),
    });
    expect(long.displayName).toBe(
      `El nombre no puede superar los ${DISPLAY_NAME_MAX_LENGTH} caracteres.`,
    );
  });

  it("recorta espacios antes de medir la longitud", () => {
    const errors = validateRegister({
      ...validRegisterInput,
      displayName: " ".repeat(DISPLAY_NAME_MIN_LENGTH + 5),
    });
    expect(errors.displayName).toBe(
      `El nombre debe tener al menos ${DISPLAY_NAME_MIN_LENGTH} caracteres.`,
    );
  });
});

describe("validateRegister — role", () => {
  it.each(REGISTRABLE_ROLES)("acepta el rol registrable '%s'", (role) => {
    const errors = validateRegister({ ...validRegisterInput, role });
    expect(errors.role).toBeUndefined();
  });

  it("rechaza 'admin': es un Role válido del sistema pero no es registrable", () => {
    const errors = validateRegister({ ...validRegisterInput, role: "admin" });
    expect(errors.role).toBe("Elige si quieres comprar o vender.");
  });

  it("rechaza un rol arbitrario que no existe en el sistema", () => {
    const errors = validateRegister({ ...validRegisterInput, role: "moderator" });
    expect(errors.role).toBe("Elige si quieres comprar o vender.");
  });
});

describe("validateRegister — caso feliz completo", () => {
  it("no produce ningún error con datos válidos", () => {
    const errors = validateRegister(validRegisterInput);
    expect(isValid(errors)).toBe(true);
    expect(errors).toEqual({});
  });
});

describe("isValid", () => {
  it("es true con un mapa de errores vacío", () => {
    expect(isValid({})).toBe(true);
  });

  it("es false si hay al menos un error", () => {
    expect(isValid({ email: "x" })).toBe(false);
  });
});
