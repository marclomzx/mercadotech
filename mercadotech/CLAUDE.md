@AGENTS.md

# MercadoTech — proyecto Next.js

Marketplace de productos tecnológicos con soporte por agentes de voz. Este
directorio es la app Next.js 15; la especificación completa de cada sesión
vive en `../MercadoTech_sesionN.md` (raíz del repo).

## Comandos

```bash
npm run dev        # levanta el servidor de desarrollo (Turbopack)
npm run build       # build de producción
npm run start        # sirve el build de producción
npm run lint         # ESLint
npx tsc --noEmit     # chequeo de tipos sin emitir archivos
```

Supabase (a partir de la Fase 2.2, requiere Supabase CLI):

```bash
supabase start          # levanta Supabase local (Postgres, Auth, Storage)
supabase db reset        # reconstruye la BD desde migrations/ + seed.sql
supabase gen types typescript --local > types/database.ts
```

## Separación por capas (regla número uno del proyecto)

```
components/       Presentación PURA. Reciben props, no hacen fetching, no conocen Supabase.
hooks/             Estado de cliente. Llaman a services. Cero lógica de negocio propia.
services/          Lógica de negocio. Cada función acepta un SupabaseClient inyectable.
lib/supabase/      Clientes: client.ts (browser/anon), server.ts (cookies+RLS),
                    middleware.ts (refresco de sesión), admin.ts (service role,
                    SOLO servidor — jamás importar desde código cliente).
lib/ai/             Únicos archivos que conocen la API del proveedor de IA (sesión 4).
lib/voice/          Únicos archivos que conocen la API de voz (sesión 8).
lib/validators/     Validación framework-agnóstica, compartida entre UI y servidor.
lib/constants/      Todos los tunables (roles, estados, límites) centralizados.
types/              Tipos de dominio + database.ts (generado por Supabase).
app/api/v1/         Route Handlers delgados, solo para lo que no puede correr
                    en el navegador (secretos de IA, service role, cookies).
```

Reglas derivadas: un archivo, una responsabilidad; sin barrels; la UI nunca
importa `lib/ai/`, `lib/voice/` ni `lib/supabase/admin.ts`; un solo camino de
datos (hooks → services → Supabase/RLS), sin API REST paralela.

## Variables de entorno

Ver `.env.example`. Copiar a `.env.local` y completar con los valores del
proyecto Supabase (Project Settings > API).
