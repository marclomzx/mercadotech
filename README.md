# MercadoTech

Marketplace de productos tecnológicos con **búsqueda semántica** y un **centro de
soporte que responde citando la documentación real** del sitio. Un vendedor
publica su catálogo con fotos y gestiona sus pedidos en un tablero; un comprador
busca por lo que quiere decir —no por las palabras exactas—, compra y sigue su
pedido.

**En producción:** <https://mercadotech-gamma.vercel.app>

> El catálogo de producción nace vacío a propósito: no hay datos de prueba en el
> sitio público. Se llena cuando un vendedor real publica.

---

## Índice

- [Qué hace](#qué-hace)
- [Stack](#stack)
- [Arquitectura en una pantalla](#arquitectura-en-una-pantalla)
- [Cómo funciona el RAG](#cómo-funciona-el-rag)
- [Puesta en marcha local](#puesta-en-marcha-local)
- [Comandos](#comandos)
- [Testing](#testing)
- [Despliegue](#despliegue)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Documentación](#documentación)

---

## Qué hace

**Para quien compra**

- Catálogo con filtros por categoría, condición y rango de precio; el estado de
  los filtros vive en la URL, así que cualquier búsqueda es compartible
- **Búsqueda en dos modos**: coincidencia exacta de texto, y *"Resultados con
  IA"* que encuentra por significado — «audífonos para jugar» encuentra una
  diadema gamer aunque el título no diga ninguna de esas palabras
- Favoritos, carrito y checkout; historial de pedidos con su estado
- Reseñas **verificadas**: solo puede calificar quien recibió el producto
- **Asistente de compras** (`/asistente`) que recomienda a partir del catálogo real
- **Soporte** (`/soporte`) que responde con citas numeradas a los artículos de
  la base de conocimiento, y abre un ticket cuando no sabe

**Para quien vende**

- Publicación con galería de imágenes **reordenable arrastrando**
- Gestión de catálogo: editar, pausar, controlar stock
- **Tablero kanban de pedidos** (pagado → enviado → entregado), operable también
  con teclado

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) · React 19 · TypeScript estricto |
| Estilos | TailwindCSS v4 · shadcn/ui (estilo `base-nova`, sobre `@base-ui/react`) |
| Backend | Supabase — Postgres, Auth, Storage, RLS, pgvector |
| IA | Hugging Face (nivel gratuito): `all-MiniLM-L6-v2` para embeddings (384 dims) + un modelo de chat configurable por variable de entorno |
| Drag & drop | dnd-kit (con soporte de teclado) |
| Testing | Vitest (unitarios) · Playwright (E2E) |
| CI/CD | GitHub Actions · Vercel |

## Arquitectura en una pantalla

La regla número uno del proyecto es la **separación por capas**. Cada flecha va
en un solo sentido y no hay atajos:

```
  components/          Presentación PURA. Reciben props. No hacen fetching.
       ↑                No conocen Supabase ni la IA.
       │
  hooks/               Estado de cliente. Llaman a services.
       │                Cero lógica de negocio propia.
       ↓
  services/            Lógica de negocio. Cada función recibe el cliente
       │                Supabase como ÚLTIMO parámetro, inyectable.
       ↓
  Supabase (RLS)       La base de datos es la que decide quién ve qué.

  app/api/v1/          Route Handlers delgados: SOLO lo que no puede correr
       ↓                en el navegador (token de IA, service role).
  lib/ai/              Únicos archivos que conocen la API del proveedor de IA.
```

**Por qué el cliente Supabase se inyecta:** la misma función de negocio sirve al
navegador (cliente anónimo, RLS activa), a un Route Handler (cliente con cookies)
y a los tests (cliente falso, sin red). Una sola implementación, tres contextos.

**Por qué la seguridad vive en la base de datos:** las políticas RLS son la
frontera real. La interfaz solo ofrece acciones que la RLS va a permitir —
defensa en profundidad, no la única defensa. El formulario de reseña, por
ejemplo, solo aparece si el usuario efectivamente puede reseñar.

**Por qué no hay una API REST paralela:** un solo camino de datos
(hooks → services → Supabase). La IA es la única excepción, y por una razón
concreta: el token de Hugging Face y la clave de service role no pueden viajar
al navegador.

Detalle completo, con el modelo relacional y las políticas RLS, en
[`docs/ARQUITECTURA.md`](mercadotech/docs/ARQUITECTURA.md).

## Cómo funciona el RAG

Ni la búsqueda semántica ni el soporte "leen" el catálogo entero en cada
consulta. Funcionan sobre **fichas numéricas** calculadas de antemano:

```
  INDEXACIÓN (una vez, y cada vez que algo cambia)

    producto o artículo ──► lib/ai/embeddings ──► vector de 384 números
                                                        │
                                                        ▼
                                          knowledge_embeddings (pgvector)

  CONSULTA (en cada pregunta del usuario)

    pregunta ──► mismo modelo ──► vector ──► match_knowledge()
                                                  │  distancia coseno
                                                  ▼
                                        los k fragmentos más cercanos
                                                  │
                                                  ▼
                                  contexto + pregunta ──► modelo de chat
                                                  │
                                                  ▼
                                        respuesta CON SUS CITAS
```

Dos consecuencias prácticas:

- **Publicar un producto lo indexa solo** (la app dispara `/api/v1/reindex`).
  Los artículos de soporte no tienen interfaz de edición: se tocan por SQL, y
  entonces hay que reindexar a mano con `scripts/index-all.ts`.
- **Cambiar de modelo de embeddings no es solo cambiar una variable**: la
  columna es `vector(384)`. Otro modelo con otra dimensión exige una migración.

Casos de prueba, calibración del umbral de similitud y diagnóstico en
[`docs/RAG.md`](mercadotech/docs/RAG.md).

## Puesta en marcha local

**Requisitos previos**

- [Node.js 24](https://nodejs.org) — es la versión que usan el CI y producción
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) **corriendo**
  (Supabase local son ~12 contenedores)
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) —
  `npm install -g supabase`
- Una cuenta gratuita de [Hugging Face](https://huggingface.co) con un token de
  tipo *Read* (solo si vas a usar la búsqueda con IA, el asistente o el soporte)

**Paso a paso, desde cero**

```bash
git clone https://github.com/marclomzx/mercadotech.git
cd mercadotech/mercadotech
```

> La app Next vive en el subdirectorio `mercadotech/`, no en la raíz del
> repositorio. **Todos los comandos de aquí en adelante se ejecutan desde ahí.**

```bash
npm ci                       # instala exactamente lo del lockfile
supabase start               # requiere Docker Desktop corriendo; la 1ª vez tarda
supabase db reset            # aplica las 24 migraciones + el seed de laboratorio
```

> **En Windows**, si más adelante vuelves a ejecutar `npm ci` con `npm run dev`
> o `npm run start` abierto, fallará con `EPERM: operation not permitted,
> unlink ... next-swc.win32-x64-msvc.node`: el proceso de Next tiene bloqueado
> su binario nativo y `npm ci` necesita borrar `node_modules` entero. Para el
> servidor primero. En un clon limpio no ocurre.

`supabase db reset` deja la base con 6 usuarios de prueba, 8 categorías, 16
productos, pedidos en todos sus estados y 10 artículos de FAQ. La contraseña
compartida de esos usuarios está escrita en `supabase/seed.sql`.

Ahora las variables de entorno:

```bash
cp .env.example .env.local
supabase status -o env       # imprime las credenciales del stack local
```

Copia de esa salida a tu `.env.local`:

| De `supabase status` | A `.env.local` |
|---|---|
| `API_URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |

`NEXT_PUBLIC_SITE_URL` ya viene con `http://localhost:3000`. Añade tu token de
Hugging Face en `HUGGINGFACEHUB_API_TOKEN` (empieza con `hf_`) si quieres las
funciones de IA.

```bash
npx tsx scripts/index-all.ts   # genera las fichas del RAG (necesita el token)
npm run dev                    # http://localhost:3000
```

El último paso es opcional pero recomendado: sin él, la búsqueda semántica no
devuelve nada y el soporte responde *"no encontré información"*. El resto del
sitio funciona igual.

**Panel de Supabase local:** `supabase status` imprime la URL de Studio, donde
puedes inspeccionar tablas, políticas y Storage.

**Para apagar todo:** `supabase stop`

**Si algo falla:** [`docs/DEBUGGING.md`](mercadotech/docs/DEBUGGING.md) tiene los
errores literales más comunes con su causa y su arreglo.

## Comandos

Todos desde `mercadotech/`:

```bash
npm run dev            # servidor de desarrollo
npm run build          # build de producción
npm run start          # sirve el build de producción
npm run lint           # ESLint
npm run type-check     # tsc --noEmit
npm run db:types       # regenera types/database.ts desde la BD local
```

`db:types` se ejecuta **después de cada migración nueva**: `types/database.ts`
es un archivo generado y no se edita a mano.

Supabase:

```bash
supabase start         # levanta el stack local
supabase db reset      # reconstruye la BD desde migrations/ + seed.sql
supabase stop          # apaga los contenedores
```

Mantenimiento del RAG:

```bash
npx tsx scripts/index-all.ts    # reindexa productos activos + artículos publicados
```

## Testing

**Unitarios** (Vitest) — cubren lógica pura y la capa de services. No abren red:
el cliente Supabase se inyecta falso y `lib/ai/` se mockea por módulo.

```bash
npm run test           # ejecuta la suite
npm run test:watch     # modo watch
npm run test:coverage  # con reporte de cobertura
```

**End-to-end** (Playwright) — navegador real contra la app real.

```bash
supabase db reset      # ⚠️ PRERREQUISITO, ver abajo
npm run test:e2e
npm run test:e2e:ui    # con la interfaz de Playwright
```

> **`supabase db reset` antes de cada corrida no es opcional.** Los E2E afirman
> sobre datos concretos del seed (un pedido en estado *pagado*, un producto sin
> stock, usuarios con nombre propio) y además **escriben**: compran, publican y
> mueven pedidos. Correrlos dos veces seguidas sin resetear da fallos que
> parecen bugs y no lo son.

Los E2E corren contra un **build de producción** (`npm run build && npm run
start`), nunca contra `next dev`: en desarrollo, Fast Refresh y StrictMode
introducen carreras que no existen en producción.

## Despliegue

Vercel está conectado al repositorio por su integración Git. **El único
disparador es el repositorio**: no hay CLI de despliegue ni tokens.

```
 rama ──► PR ──┬──► GitHub Actions: checks → e2e   (obligatorios)
               └──► Vercel: preview con URL propia
                      │
               merge bloqueado hasta que ambos estén en verde
                      │
                    merge ──► Vercel: producción
```

`main` está protegida: no se puede empujar directamente ni mergear con el CI en
rojo, ni siquiera siendo dueño del repositorio.

Guía completa —qué variable vive dónde, cómo desplegar, el smoke test y cómo
volver atrás— en [`docs/DEPLOY.md`](mercadotech/docs/DEPLOY.md).

## Estructura del proyecto

```
.
├── .github/workflows/ci.yml   Pipeline: jobs `checks` y `e2e`. Sin secretos.
├── README.md                  Este archivo.
└── mercadotech/               La aplicación Next.js
    ├── app/                   App Router. Rutas agrupadas por audiencia:
    │   ├── (shop)/              catálogo, producto, carrito, pedidos,
    │   │                        favoritos, asistente, soporte
    │   ├── (seller)/            panel del vendedor bajo /vendedor/*
    │   ├── (auth)/              login y registro
    │   └── api/v1/              chat · reindex · search/semantic
    ├── components/            Presentación pura, por dominio.
    │   ├── ui/                  shadcn (base-nova)
    │   └── shared/              Price, RatingStars, ProductImage, estados…
    ├── hooks/                 Estado de cliente. Llaman a services.
    ├── services/              Lógica de negocio. Cliente Supabase inyectable.
    ├── lib/
    │   ├── supabase/            client · server · middleware · admin
    │   ├── ai/                  embeddings · completion · prompts · contexto
    │   ├── validators/          validación pura, compartida UI/servidor
    │   └── constants/           todos los tunables, con su porqué
    ├── types/                 Dominio + database.ts (generado)
    ├── supabase/
    │   ├── migrations/          24 migraciones — la única vía de cambio de esquema
    │   ├── seed.sql             datos de laboratorio (NO van a producción)
    │   └── seed.prod.sql        seed de producción: categorías + FAQ
    ├── e2e/                   Playwright: specs + Page Objects
    ├── mcp/                   Servidor MCP de solo lectura (proceso aparte)
    ├── scripts/               index-all · seed-images
    └── docs/                  Documentación (ver abajo)
```

## Documentación

| Documento | Qué responde |
|---|---|
| [`docs/ARQUITECTURA.md`](mercadotech/docs/ARQUITECTURA.md) | Cómo está construido y por qué: capas, modelo relacional, RLS, RAG, testing, despliegue |
| [`docs/DEPLOY.md`](mercadotech/docs/DEPLOY.md) | Dónde vive cada clave, cómo desplegar un cambio, cómo volver atrás |
| [`docs/DEBUGGING.md`](mercadotech/docs/DEBUGGING.md) | Qué hacer cuando algo falla, con los errores literales más comunes |
| [`docs/RAG.md`](mercadotech/docs/RAG.md) | Casos de prueba del RAG y calibración del umbral de similitud |
| [`docs/PERFORMANCE.md`](mercadotech/docs/PERFORMANCE.md) | Métricas antes/después y qué optimizaciones se aceptaron o se revirtieron |
| [`docs/BITACORA.md`](mercadotech/docs/BITACORA.md) | Registro de decisiones y limitaciones, fase por fase |
| [`mcp/README.md`](mercadotech/mcp/README.md) | El servidor MCP: qué expone y cómo conectarlo |
| [`docs/PLAN_CURSO.md`](mercadotech/docs/PLAN_CURSO.md) | El plan original de las 8 sesiones con las que se construyó esto |

---

**Qué sigue:** la sesión 8 añade el agente de voz del centro de soporte (STT y
TTS del navegador) sobre la base de conocimiento que ya existe.
