import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Patrón oficial de @supabase/ssr: refresca el token de sesión en cada
// request antes de que llegue a Server Components/Route Handlers.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin .env.local (proyecto Supabase aún no conectado) dejamos pasar la
  // request sin refrescar sesión, en vez de tumbar toda la app en dev.
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // No eliminar: refresca el token expirado y lo propaga tanto a la request
  // como a la response. Sin esta llamada la sesión del servidor se desincroniza.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rutas que exigen sesión. NO incluye /producto, /categoria, /buscar ni la
  // home: el catálogo y el detalle son públicos (RLS ya deja ver productos
  // activos a anon). Las acciones internas del detalle (preguntar, favorito,
  // agregar al carrito) piden sesión al hacer CLIC, no al entrar — proteger
  // /producto rompería los enlaces compartibles y el SEO.
  // /asistente y /soporte se suman en la Fase 4.7 (decisión 1 de la sesión
  // 4: la IA exige sesión iniciada, también protege la cuota gratuita del
  // proveedor).
  const PROTECTED_PREFIXES = [
    "/carrito",
    "/pedidos",
    "/favoritos",
    "/vendedor",
    "/asistente",
    "/soporte",
  ];

  const { pathname } = request.nextUrl;
  const needsSession = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (needsSession && !user) {
    // Redirigir desde el middleware evita el parpadeo de renderizar la
    // página protegida y recién ahí descubrir que no hay sesión.
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
