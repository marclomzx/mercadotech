"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  isValid,
  validateRegister,
  type RegistrableRole,
  type ValidationErrors,
} from "@/lib/validators/auth";

type RegisterFormProps = {
  onSubmit: (values: {
    email: string;
    password: string;
    displayName: string;
    role: RegistrableRole;
  }) => void;
  loading?: boolean;
  error?: string | null;
};

const ROLE_OPTIONS: { value: RegistrableRole; label: string; hint: string }[] = [
  { value: "buyer", label: "Quiero comprar", hint: "Explora y compra productos." },
  { value: "seller", label: "Quiero vender", hint: "Publica y gestiona tu catálogo." },
];

// Componente PURO: valida con lib/validators/auth y entrega los valores.
// El rol elegido acá es solo una preferencia del formulario — la BD tiene
// la última palabra (handle_new_user ignora cualquier valor fuera de
// buyer/seller, así que 'admin' nunca puede llegar por esta vía).
export function RegisterForm({ onSubmit, loading = false, error }: RegisterFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<RegistrableRole>("buyer");
  const [errors, setErrors] = useState<ValidationErrors>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const values = {
      email: email.trim(),
      password,
      displayName: displayName.trim(),
      role,
    };
    const validation = validateRegister(values);
    setErrors(validation);
    if (!isValid(validation)) return;
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Crear cuenta</h1>
        <p className="text-sm text-muted-foreground">
          Únete a MercadoTech como comprador o vendedor.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="displayName">Nombre visible</Label>
        <Input
          id="displayName"
          autoComplete="name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          aria-invalid={Boolean(errors.displayName)}
          aria-describedby={errors.displayName ? "displayName-error" : undefined}
        />
        {errors.displayName && (
          <p id="displayName-error" className="text-sm text-destructive">
            {errors.displayName}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-destructive">
            {errors.email}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
        />
        {errors.password && (
          <p id="password-error" className="text-sm text-destructive">
            {errors.password}
          </p>
        )}
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">¿Cómo quieres usar MercadoTech?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={cn(
                "cursor-pointer rounded-lg border p-3 text-sm transition-colors",
                // El radio real es sr-only, así que sin esto el foco de
                // teclado era INVISIBLE: se podía tabular entre las opciones
                // sin ninguna pista de cuál estaba seleccionada. `has-*`
                // proyecta el foco del input sobre la tarjeta que lo envuelve.
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50",
                role === option.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted",
              )}
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                checked={role === option.value}
                onChange={() => setRole(option.value)}
                className="sr-only"
              />
              <span className="block font-medium">{option.label}</span>
              <span className="block text-xs text-muted-foreground">{option.hint}</span>
            </label>
          ))}
        </div>
        {errors.role && <p className="text-sm text-destructive">{errors.role}</p>}
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creando cuenta..." : "Crear cuenta"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
