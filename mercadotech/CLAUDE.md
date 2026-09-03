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
npm run test               # Vitest — lógica pura y services, sin red
npm run test:coverage       # ídem + reporte de cobertura (lib/ y services/)
npm run test:e2e             # Playwright — requiere supabase start && supabase db reset antes
npx tsx scripts/index-all.ts   # reindexa productos activos + artículos
                                 # publicados en knowledge_embeddings (RAG)
```

`db:types` se ejecuta después de CADA migración nueva: `types/database.ts`
es generado y no se edita a mano.

Supabase (a partir de la Fase 2.2, requiere Supabase CLI):

```bash
supabase start          # levanta Supabase local (Postgres, Auth, Storage)
supabase db reset        # reconstruye la BD desde migrations/ + seed.sql
```

Servidor MCP (sesión 5, `mcp/` — ver `mcp/README.md`):

```bash
npx tsx mcp/src/index.ts   # dev, SIEMPRE desde la raíz (alias @/* lo exige)
cd mcp && npm run build     # build de producción → mcp/dist/index.js
npx @modelcontextprotocol/inspector npx tsx mcp/src/index.ts   # Inspector
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
lib/constants/      roles.ts · catalog.ts · orders.ts · product.ts · ai.ts
                    (todos los tunables — el umbral de similitud del RAG incluido).
lib/validators/     auth.ts · product.ts. Puras, sin React ni Supabase.
lib/ai/             Únicos archivos que conocen la API del proveedor de IA
                    (embeddings.ts, completion.ts, prompts.ts, context-builder.ts).
lib/voice/          Únicos archivos que conocen la API de voz (sesión 8).
types/              Tipos de dominio + database.ts (generado, no editar a mano).
app/api/v1/         Route Handlers delgados: reindex, search/semantic, chat —
                    todo lo que no puede correr en el navegador (token de IA,
                    service role, cookies).
mcp/                Servidor MCP de solo lectura (sesión 5), proceso Node aparte
                    de la web: SOLO importa services/, lib/ai/, lib/constants/ y
                    types/ — jamás app/, components/ ni hooks/. Sus clientes de
                    Supabase se crean en mcp/src/context.ts, nunca en
                    lib/supabase/admin.ts (server-only revienta bajo Node puro).
```

Reglas derivadas: un archivo, una responsabilidad; sin barrels; la UI nunca
importa `lib/voice/` ni `lib/supabase/admin.ts`; un solo camino de datos para
todo lo que no es IA (hooks → services → Supabase/RLS), sin API REST
paralela — la IA es la única excepción (ver abajo).

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
* La UI nunca importa `lib/ai/`: el navegador llega a la IA solo vía
  hook → fetch a `app/api/v1/*` → service → `lib/ai/` (el token de Hugging
  Face y el cliente admin no pueden viajar al navegador).

## Verificación de capas (los cinco deben devolver vacío)

```bash
grep -rl "@/lib/supabase" components hooks
grep -rl "from \"@/services" components
grep -rln "@huggingface" --include="*.ts" . | grep -v node_modules | grep -v lib/ai
grep -rl 'from "@/lib/supabase/admin"' app components hooks services | grep -v "api/v1"
grep -rlE "from \"@/(app|components|hooks)" mcp/src
```

## Skills de gobernanza (`.claude/skills/`, sesión 5)

4 Skills que Claude Code carga solo cuando la petición coincide con su
`description`: `mercadotech-architecture-enforcer` (gate PREVIO a crear o
mover un archivo — ¿va aquí, con estas dependencias?),
`mercadotech-code-reviewer` (informe /10 sobre código YA escrito),
`mercadotech-tech-lead` (scorecard ponderado de diseño y deuda técnica) y
`mercadotech-automatic-validator` (veredicto binario APROBADA/FALLIDA sobre
una checklist fija). Las cuatro REPORTAN; ninguna edita código — la
corrección siempre es un paso aparte y humano-supervisado.

**Norma del ciclo (sesión 6):** al cerrar cualquier feature, el orden es
`mercadotech-code-reviewer` → correcciones → `mercadotech-automatic-validator`,
que desde esta sesión corre `npm run test` (obligatorio) y `npm run
test:e2e` si el stack local está arriba. Diagnóstico de fallos en
[docs/DEBUGGING.md](docs/DEBUGGING.md).

## Testing (sesión 6)

* El test unitario vive JUNTO al archivo (`cart.service.test.ts` al lado de
  `cart.service.ts`); los E2E viven en `e2e/`.
* Los tests inyectan el cliente Supabase por parámetro — jamás `vi.mock` de
  `lib/supabase/*`; `lib/ai/*` sí se mockea por módulo (única excepción,
  comentada en el test que la usa).
* El test documenta el CONTRATO REAL, no el deseado: si un comportamiento
  parece un bug, se ancla al código y se anota — no se "corrige" callado.
* `data-testid` en kebab-case con prefijo de dominio
  (`cart-item-quantity`, `kanban-column-pagado`) — único cambio permitido
  en un componente solo para testear, nunca lógica ni estilos.

## CI (GitHub Actions, sesión 6)

`.github/workflows/ci.yml` corre en cada push a `main` y en cada PR: job
`checks` (lint, type-check, tests con cobertura, type-check de `mcp/`) y
job `e2e` (Supabase efímero + Playwright chromium, contra
`npm run build && npm run start` — nunca contra `next dev`). Cero secretos:
las claves del stack efímero se leen en caliente con `supabase status`.
`packageManager` en `package.json` debe coincidir SIEMPRE con el pin de
npm del workflow (lección "Missing ... from lock file") — no se toca uno
sin el otro.

## Mapa de rutas

`(shop)`: `/` · `/buscar?q=` · `/categoria/[slug]` · `/producto/[id]` ·
`/favoritos` · `/carrito` · `/pedidos` · `/pedidos/[id]` · `/asistente` ·
`/soporte`
`(seller)`: `/vendedor/productos` · `/vendedor/publicar` ·
`/vendedor/productos/[id]/editar` · `/vendedor/pedidos`
`(auth)`: `/login` · `/register`

El panel del vendedor va bajo `/vendedor/` para no colisionar con `/pedidos`
del comprador. `/carrito`, `/pedidos`, `/favoritos`, `/vendedor`,
`/asistente` y `/soporte` están protegidas en `lib/supabase/middleware.ts`
(la IA exige sesión); el catálogo, el detalle y la búsqueda por texto son
públicos — solo la pestaña "Resultados con IA" de `/buscar` pide sesión.

## Deploy y producción (sesión 7)

**En producción:** <https://mercadotech-gamma.vercel.app> (Supabase hosted).

* Deploy: PR → preview de Vercel; merge a `main` (checks obligatorios) →
  producción. `main` está protegida: `checks` y `e2e` requeridos, sin bypass
  ni para el dueño. **Ni siquiera un cambio de una línea en docs entra por
  push directo.**
* Secretos SOLO en el dashboard de Vercel, cargados a mano; Actions no usa
  ninguno. Tras cambiar una env: **redeploy** (el build ya hecho lleva los
  valores incrustados). Nunca en el repo, ni en el chat, ni en logs.
* Producción nace con catálogo VACÍO a propósito (`supabase/seed.prod.sql`:
  categorías + FAQ, sin usuarios ni productos). El `EmptyState` es correcto.
* **Medir → cambiar → medir.** Ninguna optimización entra sin su número de
  antes y de después; lo que no mueve la aguja se revierte y se anota como
  intento fallido. Registro en [docs/PERFORMANCE.md](docs/PERFORMANCE.md).
  Toda medición contra build de producción, jamás contra `next dev`.
* Variables, flujo, smoke test y rollback en
  [docs/DEPLOY.md](docs/DEPLOY.md).

## Estado del proyecto

* **Completadas:** sesión 2 (infraestructura), sesión 3 (MVP funcional),
  sesión 4 (RAG: búsqueda semántica, asesor de compras, soporte con
  tickets), sesión 5 (servidor MCP de solo lectura + 4 Skills de
  gobernanza), sesión 6 (292 tests unitarios + 8 E2E + CI en GitHub
  Actions, verde) y sesión 7 (performance medida, gobernanza de secretos,
  despliegue a Vercel y documentación).
* **Pendientes heredados:** sesión 1 completa (`docs/COSTOS.md`,
  `docs/PROMPTS.md`) y Fase 2.6 (`supabase/tests/` vacío: faltan los scripts
  de validación RLS).
* **Limitación vigente:** Lighthouse quedó en 48/46 (objetivo ≥ 90) y no se
  midió contra la URL de Vercel. La causa está medida y documentada: el
  catálogo se renderiza en cliente y el TBT es el techo — ver
  [docs/PERFORMANCE.md](docs/PERFORMANCE.md).
* **Siguiente:** sesión 8 — agente de voz de soporte (STT/TTS) sobre la base
  de conocimiento y los tickets existentes; reutiliza `get_order_status` del
  servidor MCP.
* Puerta de entrada para alguien nuevo: el [README](../README.md) de la raíz
  (qué es, cómo levantarlo, comandos). Detalle por fase, decisiones y
  limitaciones en [docs/BITACORA.md](docs/BITACORA.md); arquitectura en
  [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md); casos del RAG en
  [docs/RAG.md](docs/RAG.md); pasada de calidad de la sesión 3 en
  [docs/SESION3_CHECKLIST.md](docs/SESION3_CHECKLIST.md). El plan del curso
  se conserva en [docs/PLAN_CURSO.md](docs/PLAN_CURSO.md).

## Variables de entorno

Ver `.env.example` (8 variables). En local: copiar a `.env.local` y
completar con `supabase status -o env`. En producción viven en Vercel — ver
la tabla de gobernanza de [docs/DEPLOY.md](docs/DEPLOY.md), que dice de cada
una dónde vive, quién la lee y si es pública o secreta.
