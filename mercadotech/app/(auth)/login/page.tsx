"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";

import { LoginForm } from "@/components/auth/LoginForm";
import { LoadingState } from "@/components/shared/LoadingState";
import { useAuth } from "@/hooks/useAuth";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loading, error } = useAuth();

  // redirectTo lo pone el middleware al interceptar una ruta protegida.
  const redirectTo = searchParams.get("redirectTo") ?? "/";

  async function handleSubmit(values: { email: string; password: string }) {
    const ok = await login(values.email, values.password);
    if (!ok) return;
    toast.success("Sesión iniciada");
    router.push(redirectTo);
    // refresh() revalida los Server Components con la cookie ya escrita —
    // sin esto el layout seguiría renderizando el estado anónimo.
    router.refresh();
  }

  return <LoginForm onSubmit={handleSubmit} loading={loading} error={error} />;
}

export default function LoginPage() {
  // useSearchParams exige un Suspense boundary para no forzar el render
  // dinámico de toda la ruta.
  return (
    <Suspense fallback={<LoadingState lines={4} />}>
      <LoginPageContent />
    </Suspense>
  );
}
