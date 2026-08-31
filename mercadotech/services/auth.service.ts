import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import type { RegistrableRole } from "@/lib/validators/auth";
import type { Database } from "@/types/database";
import type { Profile } from "@/types/user";

type Client = SupabaseClient<Database>;

export type RegisterParams = {
  email: string;
  password: string;
  displayName: string;
  role: RegistrableRole;
};

export type CurrentUser = {
  user: User;
  profile: Profile | null;
};

// Suscripción a los cambios de sesión. Vive acá y no en el hook para que
// `hooks/` no importe nunca @/lib/supabase directamente (regla de capas:
// hooks → services → Supabase). Devuelve la función para desuscribirse.
//
// Dispara también en el montaje inicial (evento INITIAL_SESSION), así que
// el hook la usa como carga inicial y como suscripción a la vez.
export function onAuthStateChange(
  callback: (user: User | null) => void,
  supabase: Client = createClient(),
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

// Services: funciones puras async, cliente inyectable como ÚLTIMO parámetro
// (default: navegador). No importan React. Lanzan el error de Supabase tal
// cual; el hook lo traduce a estado.

export async function register(
  { email, password, displayName, role }: RegisterParams,
  supabase: Client = createClient(),
) {
  // display_name y role viajan en options.data → raw_user_meta_data, que es
  // lo que lee handle_new_user al crear el profile. NO se hace un update a
  // profiles después: protect_profile_role_trigger lo rechazaría, y el rol
  // solo puede fijarse en ese INSERT (ver la migración de la Fase 3.3).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, role },
    },
  });
  if (error) throw error;
  return data;
}

export async function login(
  { email, password }: { email: string; password: string },
  supabase: Client = createClient(),
) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function logout(supabase: Client = createClient()) {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(
  supabase: Client = createClient(),
): Promise<CurrentUser | null> {
  const { data, error } = await supabase.auth.getUser();
  // Sin sesión, getUser devuelve error: es el caso normal de un visitante
  // anónimo, no un fallo que haya que propagar.
  if (error || !data.user) return null;

  return {
    user: data.user,
    profile: await getProfile(data.user.id, supabase),
  };
}

export async function getProfile(
  userId: string,
  supabase: Client = createClient(),
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}
