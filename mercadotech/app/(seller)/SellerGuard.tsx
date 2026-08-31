"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { toast } from "sonner";

import { LoadingState } from "@/components/shared/LoadingState";
import { useAuth } from "@/hooks/useAuth";

const ALLOWED_ROLES = ["seller", "admin"];

// Segunda capa de defensa, no la única: el middleware ya redirige a /login
// si NO hay sesión en /vendedor/*. Este guard cubre el caso distinto — hay
// sesión, pero el rol no alcanza (un buyer entrando al panel de vendedor).
// La RLS es la tercera capa: aunque alguien burlara ambas, no podría leer
// ni escribir productos ajenos.
export function SellerGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { profile, initializing } = useAuth();
  // Evita que el toast se dispare dos veces (StrictMode monta dos veces en
  // desarrollo).
  const notified = useRef(false);

  const allowed = Boolean(profile && ALLOWED_ROLES.includes(profile.role));

  useEffect(() => {
    if (initializing || allowed || notified.current) return;
    notified.current = true;
    toast.error("Necesitas una cuenta de vendedor");
    router.replace("/");
  }, [initializing, allowed, router]);

  if (initializing) {
    return <LoadingState lines={4} />;
  }

  // Mientras corre el redirect no se renderiza el panel: evita el parpadeo
  // de mostrar contenido de vendedor a quien no lo es.
  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
