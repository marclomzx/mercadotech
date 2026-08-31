"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";

import { RegisterForm } from "@/components/auth/RegisterForm";
import { LoadingState } from "@/components/shared/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import type { RegistrableRole } from "@/lib/validators/auth";

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, loading, error } = useAuth();

  const redirectTo = searchParams.get("redirectTo") ?? "/";

  async function handleSubmit(values: {
    email: string;
    password: string;
    displayName: string;
    role: RegistrableRole;
  }) {
    const { ok, needsEmailConfirmation } = await register(values);
    if (!ok) return;

    if (needsEmailConfirmation) {
      // Solo ocurre en un proyecto hosted con confirmación activa; en local
      // enable_confirmations = false y la sesión queda abierta al instante.
      toast.info("Revisa tu correo para confirmar la cuenta.");
      router.push("/login");
      return;
    }

    toast.success("Cuenta creada");
    router.push(redirectTo);
    router.refresh();
  }

  return <RegisterForm onSubmit={handleSubmit} loading={loading} error={error} />;
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<LoadingState lines={5} />}>
      <RegisterPageContent />
    </Suspense>
  );
}
