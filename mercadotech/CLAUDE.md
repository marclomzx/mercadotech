@AGENTS.md

# MercadoTech — proyecto Next.js

Marketplace de productos tecnológicos con soporte por agentes de voz. Este
directorio es la app Next.js 15; la especificación completa de cada sesión
vive en `../MercadoTech_sesionN.md` (raíz del repo).

## Comandos

```bash
npm run dev          # servidor de desarrollo
npm run build         # build de producción
npm run start          # sirve el build de producción
npm run lint            # ESLint
npm run type-check       # tsc --noEmit
npm run db:types          # regenera types/database.ts desde la BD local
```

`db:types` se ejecuta después de CADA migración nueva: `types/database.ts`
es generado y no se edita a mano.

Supabase (a partir de la Fase 2.2, requiere Supabase CLI):

```bash
supabase start          # levanta Supabase local (Postgres, Auth, Storage)
supabase db reset        # reconstruye la BD desde migrations/ + seed.sql
```

## Separación por capas (regla número uno del proyecto)

```
components/       Presentación PURA. Reciben props, no hacen fetching, no conocen Supabase.
   ui/            shadcn (estilo base-nova, sobre @base-ui/react — NO Radix).
   shared/        Reutilizables: Price, RatingStars, ConditionBadge, ProductImage,
                   Empty/Error/LoadingState, Container. Revisar antes de crear uno nuevo.
   layout/ catalog/ product/ cart/ orders/ seller/ auth/   por dominio.
hooks/             Estado de cliente. Llaman a services. Cero lógica de negocio propia.
services/          Lógica de negocio. Cada función acepta un SupabaseClient inyectable.
lib/supabase/      Clientes: client.ts (browser/anon), server.ts (cookies+RLS),
                    middleware.ts (sesión + rutas protegidas), admin.ts (service role,
                    SOLO servidor — jamás importar desde código cliente).
lib/constants/      roles.ts · catalog.ts · orders.ts · product.ts (todos los tunables).
lib/validators/     auth.ts · product.ts. Puras, sin React ni Supabase.
lib/ai/             Únicos archivos que conocen la API del proveedor de IA (sesión 4).
lib/voice/          Únicos archivos que conocen la API de voz (sesión 8).
types/              Tipos de dominio + database.ts (generado, no editar a mano).
app/api/v1/         Route Handlers delgados, solo para lo que no puede correr
                    en el navegador (secretos de IA, service role, cookies).
```

Reglas derivadas: un archivo, una responsabilidad; sin barrels; la UI nunca
importa `lib/ai/`, `lib/voice/` ni `lib/supabase/admin.ts`; un solo camino de
datos (hooks → services → Supabase/RLS), sin API REST paralela.

**Los layouts son Server Components y no pueden usar hooks, y `components/`
no puede importar `hooks/`.** El punto de conexión son componentes cliente
colocados en `app/` (`ShopNavbar.tsx`, `SellerGuard.tsx`, `CatalogView.tsx`,
`ProductDetailView.tsx`, …): usan el hook y pasan props a los componentes puros.

## Convenciones de código

* Firma de service: `fn(args, supabase: Client = createClient())` — cliente
  inyectable como ÚLTIMO parámetro. No importan React. Propagan el error de
  Supabase tal cual; el hook lo traduce a estado.
* `numeric` (price, total, price_snapshot) llega como `string` desde
  PostgREST: el service lo convierte con `Number()`; los componentes siempre
  reciben `number`.
* Los componentes reciben `image_url` ya resuelta (el service llama a
  `storage.getPublicUrl`), nunca el `image_path` crudo.
* Filtros de catálogo: la URL (`useSearchParams`) es la única fuente de
  verdad. Cambiar un filtro reescribe la URL y vuelve a página 1.
* Las transiciones del kanban viven en `useSellerOrders` (`canMove`): la RLS
  permite pagado/enviado/entregado pero NO valida la secuencia.
* La UI solo ofrece acciones que la RLS va a permitir (defensa en
  profundidad): p. ej. el formulario de reseña solo aparece si `canReview`.
* Componentes shadcn `base-nova`: los triggers usan `render={<Button />}`,
  NO `asChild`. Para un link con aspecto de botón: `buttonVariants({...})`.

## Verificación de capas (ambos deben devolver vacío)

```bash
grep -rl "@/lib/supabase" components hooks
grep -rl "from \"@/services" components
```

## Mapa de rutas

`(shop)`: `/` · `/buscar?q=` · `/categoria/[slug]` · `/producto/[id]` ·
`/favoritos` · `/carrito` · `/pedidos` · `/pedidos/[id]`
`(seller)`: `/vendedor/productos` · `/vendedor/publicar` ·
`/vendedor/productos/[id]/editar` · `/vendedor/pedidos`
`(auth)`: `/login` · `/register`

El panel del vendedor va bajo `/vendedor/` para no colisionar con `/pedidos`
del comprador. `/carrito`, `/pedidos`, `/favoritos` y `/vendedor` están
protegidas en `lib/supabase/middleware.ts`; el catálogo y el detalle son
públicos.

## Estado del proyecto

* **Completadas:** sesión 2 (infraestructura) y sesión 3 (MVP funcional).
* **Pendientes heredados:** sesión 1 completa (`docs/COSTOS.md`,
  `docs/PROMPTS.md`) y Fase 2.6 (`supabase/tests/` vacío: faltan los scripts
  de validación RLS).
* **Siguiente:** sesión 4 (pgvector, embeddings, búsqueda semántica, RAG).
* Detalle por fase, decisiones y limitaciones vigentes en
  [docs/BITACORA.md](docs/BITACORA.md); pasada de calidad en
  [docs/SESION3_CHECKLIST.md](docs/SESION3_CHECKLIST.md); arquitectura en
  [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Variables de entorno

Ver `.env.example`. Copiar a `.env.local` y completar con los valores del
proyecto Supabase (Project Settings > API).
