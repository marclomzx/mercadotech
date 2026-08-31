import type { Role } from "@/lib/constants/roles";

// Validación framework-agnóstica: sin React, sin Supabase. La comparten los
// formularios (antes de llamar al service) y cualquier código de servidor
// que la necesite. Devuelve un mapa campo → mensaje; vacío = válido.

// Roles que un usuario puede elegir al registrarse. 'admin' NO está aquí a
// propósito: la BD lo rechaza igual (ver handle_new_user), esto es la
// primera línea de defensa en el cliente.
export const REGISTRABLE_ROLES = ["buyer", "seller"] as const;
export type RegistrableRole = (typeof REGISTRABLE_ROLES)[number];

// El mínimo real lo impone Supabase (config.toml: minimum_password_length),
// pero la spec pide >= 8 en la app — el más estricto de los dos gana.
export const PASSWORD_MIN_LENGTH = 8;
export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 60;

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  displayName: string;
  role: Role | string;
};

export type ValidationErrors = Record<string, string>;

// Suficiente para atrapar typos evidentes sin rechazar direcciones válidas
// raras: la verificación real la hace Supabase Auth al registrar.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(input: LoginInput): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!input.email.trim()) {
    errors.email = "Ingresa tu correo.";
  } else if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = "Ingresa un correo válido.";
  }

  if (!input.password) {
    errors.password = "Ingresa tu contraseña.";
  }

  return errors;
}

export function validateRegister(input: RegisterInput): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!input.email.trim()) {
    errors.email = "Ingresa tu correo.";
  } else if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = "Ingresa un correo válido.";
  }

  if (!input.password) {
    errors.password = "Ingresa una contraseña.";
  } else if (input.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }

  const displayName = input.displayName.trim();
  if (displayName.length < DISPLAY_NAME_MIN_LENGTH) {
    errors.displayName = `El nombre debe tener al menos ${DISPLAY_NAME_MIN_LENGTH} caracteres.`;
  } else if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    errors.displayName = `El nombre no puede superar los ${DISPLAY_NAME_MAX_LENGTH} caracteres.`;
  }

  if (!REGISTRABLE_ROLES.includes(input.role as RegistrableRole)) {
    errors.role = "Elige si quieres comprar o vender.";
  }

  return errors;
}

export function isValid(errors: ValidationErrors): boolean {
  return Object.keys(errors).length === 0;
}
