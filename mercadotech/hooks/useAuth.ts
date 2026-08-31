"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

import type { RegistrableRole } from "@/lib/validators/auth";
import * as authService from "@/services/auth.service";
import type { Profile } from "@/types/user";

type AuthState = {
  user: User | null;
  profile: Profile | null;
  initializing: boolean;
  loading: boolean;
  error: string | null;
};

const INITIAL_STATE: AuthState = {
  user: null,
  profile: null,
  initializing: true,
  loading: false,
  error: null,
};

// Hook: estado de cliente + llamadas a services. Sin reglas de negocio
// propias — solo traduce el resultado del service a estado de React.
export function useAuth() {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  useEffect(() => {
    let active = true;

    // La suscripción vive en el service (regla de capas: los hooks nunca
    // importan el cliente de Supabase directamente). Dispara también en el
    // montaje inicial (evento INITIAL_SESSION), así que sirve de carga
    // inicial y de suscripción posterior — no hace falta getUser() aparte.
    const unsubscribe = authService.onAuthStateChange((sessionUser) => {
      if (!sessionUser) {
        if (active) {
          setState((prev) => ({
            ...prev,
            user: null,
            profile: null,
            initializing: false,
          }));
        }
        return;
      }

      // Al cambiar la sesión se recarga el profile (el rol vive ahí, no en
      // el JWT). Se hace fuera del callback síncrono porque el cliente de
      // Supabase no admite llamadas await dentro del propio listener.
      void authService
        .getProfile(sessionUser.id)
        .then((profile) => {
          if (!active) return;
          setState((prev) => ({
            ...prev,
            user: sessionUser,
            profile,
            initializing: false,
          }));
        })
        .catch(() => {
          if (!active) return;
          setState((prev) => ({
            ...prev,
            user: sessionUser,
            profile: null,
            initializing: false,
          }));
        });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await authService.login({ email, password });
      return true;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "No se pudo iniciar sesión.",
      }));
      return false;
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const register = useCallback(
    async (params: {
      email: string;
      password: string;
      displayName: string;
      role: RegistrableRole;
    }) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const data = await authService.register(params);
        // Con enable_confirmations = false (local) el registro deja sesión
        // iniciada de inmediato. En un proyecto hosted con confirmación por
        // correo activa, `session` viene null y hay que avisar al usuario.
        return { ok: true, needsEmailConfirmation: !data.session };
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "No se pudo crear la cuenta.",
        }));
        return { ok: false, needsEmailConfirmation: false };
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await authService.logout();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "No se pudo cerrar sesión.",
      }));
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  return { ...state, login, register, logout };
}
