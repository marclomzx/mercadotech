import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

// ⚠️ ADVERTENCIA: este cliente usa la service role key y BYPASEA Row Level
// Security por completo. Es SOLO PARA SERVIDOR (Route Handlers, Server
// Actions, scripts). JAMÁS importar este archivo desde un Client Component
// ni desde cualquier código que se ejecute en el navegador — expondría la
// service role key y anularía toda la seguridad de la base de datos.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
