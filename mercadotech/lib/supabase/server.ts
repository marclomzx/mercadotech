import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

// Cliente de servidor (Server Components, Server Actions, Route Handlers).
// Usa la anon key + cookies de sesión: respeta RLS igual que el cliente del navegador.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll fue llamado desde un Server Component: se ignora porque
            // el middleware ya se encarga de refrescar la sesión en cada request.
          }
        },
      },
    },
  );
}
