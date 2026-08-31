# MercadoTech — Sesión 2: Arquitectura Escalable y Backend con Supabase

## Este documento contiene la especificación completa de la sesión. Léelo completamente antes de generar cualquier código. No hagas suposiciones fuera de lo especificado.

**Prompts de la sesión (ejecutar en orden):**

1. "Lee `mercadotech/MercadoTech_sesion2.md` completo y confírmame que entiendes el alcance. No generes código todavía."
2. "Ejecuta la Fase 2.1: genera la estructura del proyecto y la configuración inicial."
3. "Ejecuta la Fase 2.2: genera el esquema de la base de datos y las migraciones."
4. "Ejecuta la Fase 2.3: genera las políticas RLS."
5. "Ejecuta la Fase 2.4: genera los buckets de Storage y sus políticas."
6. "Ejecuta la Fase 2.5: genera el `seed.sql`."
7. "Ejecuta la Fase 2.6: genera los scripts para validar las políticas RLS."
8. "Ejecuta la Fase 2.7: genera la documentación técnica de la arquitectura."

---

## Objetivo general

Construir la infraestructura completa de MercadoTech: proyecto Next.js 15
configurado, base de datos relacional con integridad referencial, seguridad RLS
en todas las tablas, Storage para imágenes, datos de prueba y scripts de
validación. **Sin funcionalidades de negocio ni interfaces** (eso es la sesión 3).

## Objetivos específicos

* Diseñar una arquitectura basada en Next.js 15 + Supabase, escalable por capas.
* Crear y migrar la base de datos usando migraciones reproducibles.
* Implementar seguridad RLS para cada tabla y cada operación.
* Configurar Storage con políticas por carpeta de propietario.
* Sembrar datos de prueba realistas que respeten todas las restricciones.
* Validar las políticas RLS con escenarios de cada rol.

## Tecnologías base

* Next.js 15 (App Router) · React 19 · TypeScript
* TailwindCSS v4 · shadcn/ui (solo inicialización)
* Supabase: PostgreSQL, Auth, Storage · Supabase CLI

---

# FASES

## Fase 2.1 — Estructura del proyecto y configuración inicial

**Prompt sugerido:** "Ejecuta la Fase 2.1 de `MercadoTech_sesion2.md`: genera la estructura del proyecto y la configuración inicial."

Instrucciones:

1. Crear el proyecto Next.js 15 con App Router, TypeScript estricto, TailwindCSS
   v4 y ESLint. Inicializar shadcn/ui (solo `components.json` y utilidades base
   como `cn` — sin instalar componentes de dominio todavía).
2. Crear la estructura de carpetas completa (vacías con `.gitkeep` donde aplique):

```
mercadotech/
├── app/
│   ├── (auth)/                 # login, register (sesión 3)
│   ├── (shop)/                 # catálogo, producto, carrito, pedidos (sesión 3)
│   ├── (seller)/               # panel del vendedor (sesión 3)
│   └── api/v1/                 # solo lo server-only (sesiones 3-4)
├── components/                 # presentación pura
├── hooks/                      # estado de cliente
├── services/                   # lógica de negocio (cliente inyectable)
├── lib/
│   ├── supabase/               # client.ts, server.ts, middleware.ts, admin.ts
│   ├── validators/
│   ├── constants/
│   ├── ai/                     # sesión 4
│   ├── voice/                  # sesión 8
│   └── utils.ts
├── types/                      # product.ts, order.ts, user.ts, ... database.ts (generado)
├── supabase/
│   ├── migrations/
│   ├── schema.sql              # referencia, NO fuente de verdad
│   ├── policies.sql            # referencia, NO fuente de verdad
│   ├── seed.sql
│   └── tests/                  # validación RLS (Fase 2.6)
└── docs/
```

3. Crear los clientes de Supabase en `lib/supabase/`:
   * `client.ts` — navegador, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`createBrowserClient` de `@supabase/ssr`).
   * `server.ts` — servidor con cookies (`createServerClient` + `next/headers`), respeta RLS.
   * `middleware.ts` — refresco de sesión (patrón oficial de `@supabase/ssr`) + `middleware.ts` raíz que lo usa.
   * `admin.ts` — service role (`SUPABASE_SERVICE_ROLE_KEY`), **solo servidor**; comentario de advertencia: bypasea RLS, jamás importarlo desde código cliente.
4. Crear `.env.example` documentado: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_SITE_URL` (las variables de IA se agregan en la sesión 4).
5. Crear `lib/constants/roles.ts`: `'buyer' | 'seller' | 'admin'` y estados:
   pedidos `'pendiente' | 'pagado' | 'enviado' | 'entregado' | 'cancelado'`,
   tickets `'abierto' | 'en_proceso' | 'resuelto' | 'cerrado'`,
   condición `'nuevo' | 'usado' | 'reacondicionado'`.
6. Actualizar `CLAUDE.md` con los comandos reales (`npm run dev`, etc.).

Criterios de aceptación: `npm run dev` levanta la página por defecto sin errores;
`npm run lint` y `tsc --noEmit` pasan.

## Fase 2.2 — Esquema de base de datos y migraciones

**Prompt sugerido:** "Ejecuta la Fase 2.2 de `MercadoTech_sesion2.md`: genera el esquema y las migraciones."

Una migración por bloque lógico (extensiones → tablas en orden de dependencia →
funciones). Las migraciones deben permitir reconstruir la BD desde cero solo con
`supabase db reset`. Todas las tablas con RLS habilitado desde su creación
(políticas en Fase 2.3). Actualizar `schema.sql` como copia de referencia.

### Entidades

**PROFILES** — 1:1 con `auth.users` (mismo UUID como PK y FK, `on delete cascade`).

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | FK → auth.users |
| display_name | text | nombre visible |
| phone | text | |
| role | text | check: buyer/seller/admin, default 'buyer' |
| avatar_path | text | ruta en Storage |
| created_at | timestamptz | default now() |

Trigger `handle_new_user` (SECURITY DEFINER, `set search_path = public`):
inserta el profile al crearse el usuario en `auth.users`.

**CATEGORIES** — árbol simple de categorías tecnológicas.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| name | text | unique, not null |
| slug | text | unique, not null |
| parent_id | uuid | FK → categories, nullable |
| created_at | timestamptz | |

**PRODUCTS**

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| seller_id | uuid | FK → profiles, not null |
| category_id | uuid | FK → categories, not null |
| title | text | not null |
| description | text | |
| brand | text | |
| condition | text | check nuevo/usado/reacondicionado, default 'nuevo' |
| price | numeric(12,2) | check > 0 |
| stock | integer | check >= 0, default 0 |
| is_active | boolean | default true |
| created_at / updated_at | timestamptz | |

**PRODUCT_IMAGES** — galería ordenable (el orden lo define `position`; el
drag & drop de la sesión 3 actualiza este campo).

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| product_id | uuid | FK → products, cascade |
| image_path | text | not null, ruta en Storage |
| position | integer | not null, default 0 |

**CART_ITEMS** — carrito persistente por usuario.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK → profiles, cascade |
| product_id | uuid | FK → products, cascade |
| quantity | integer | check > 0 |
| created_at | timestamptz | |

`unique(user_id, product_id)`.

**ORDERS**

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| buyer_id | uuid | FK → profiles, not null |
| status | text | check con los 5 estados, default 'pendiente' |
| total | numeric(12,2) | not null |
| created_at | timestamptz | |

**ORDER_ITEMS** — con **snapshot** de título y precio (si el vendedor luego
edita el producto, el pedido histórico no cambia).

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| order_id | uuid | FK → orders, cascade |
| product_id | uuid | FK → products |
| seller_id | uuid | FK → profiles (denormalizado para RLS del vendedor) |
| title_snapshot | text | not null |
| price_snapshot | numeric(12,2) | not null |
| quantity | integer | check > 0 |

**QUESTIONS** — preguntas y respuestas estilo Mercado Libre.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| product_id | uuid | FK → products, cascade |
| user_id | uuid | FK → profiles (quien pregunta) |
| question | text | not null |
| answer | text | nullable (responde el vendedor) |
| answered_at | timestamptz | nullable |
| created_at | timestamptz | |

**REVIEWS** — reseñas verificadas: solo de quien compró.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| product_id | uuid | FK → products, cascade |
| buyer_id | uuid | FK → profiles |
| order_id | uuid | FK → orders (la compra que verifica) |
| rating | integer | check between 1 and 5 |
| comment | text | |
| created_at | timestamptz | |

`unique(product_id, buyer_id)` — una reseña por comprador y producto.

**FAVORITES**

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id / product_id | uuid | FKs, cascade |
| created_at | timestamptz | |

`unique(user_id, product_id)`.

**PRODUCT_VIEWS** — cada apertura de un producto es un evento (sin contador).

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| product_id | uuid | FK → products, cascade |
| user_id | uuid | FK → profiles |
| viewed_at | timestamptz | |

**SUPPORT_ARTICLES** — base de conocimiento (FAQ) para el RAG de soporte (sesión 4).

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| title | text | not null |
| content | text | not null |
| category | text | ej. 'envíos', 'pagos', 'devoluciones', 'cuenta' |
| is_published | boolean | default true |
| created_at / updated_at | timestamptz | |

**SUPPORT_TICKETS** + **TICKET_MESSAGES** — soporte (los usa el agente de voz en la sesión 8).

| support_tickets | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | FK → profiles |
| subject | text | not null |
| status | text | check con los 4 estados, default 'abierto' |
| channel | text | check 'chat'/'voz', default 'chat' |
| created_at | timestamptz | |

| ticket_messages | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| ticket_id | uuid | FK → support_tickets, cascade |
| sender_role | text | check 'usuario'/'agente'/'humano' |
| content | text | not null |
| created_at | timestamptz | |

### Función transaccional de checkout

Migración con `create_order_from_cart(p_buyer_id uuid) returns uuid`
(plpgsql, SECURITY DEFINER, `set search_path = public`), que en UNA transacción:

1. Lee los `cart_items` del comprador; falla si el carrito está vacío.
2. Verifica stock de cada producto (`for update` para evitar carreras); falla
   con mensaje claro si algún producto no tiene stock suficiente o está inactivo.
3. Crea el `order` (status 'pendiente') y los `order_items` con snapshots.
4. Descuenta stock y vacía el carrito.
5. Devuelve el id del pedido.

`revoke execute from public/anon; grant execute to authenticated`. La función
valida internamente que `p_buyer_id = auth.uid()`.

### Índices

`products(seller_id)`, `products(category_id)`, `products(is_active)`,
`product_images(product_id)`, `cart_items(user_id)`, `orders(buyer_id)`,
`order_items(order_id)`, `order_items(seller_id)`, `questions(product_id)`,
`reviews(product_id)`, `favorites(user_id)`, `product_views(product_id)`,
`support_tickets(user_id)`, `ticket_messages(ticket_id)`.

### Restricciones globales

* Email único (lo garantiza `auth.users`).
* Integridad referencial en TODAS las FKs.
* Un like/favorito/reseña/ítem de carrito único por (usuario, producto).
* Precios > 0, stock >= 0, rating 1–5.

## Fase 2.3 — Políticas RLS

**Prompt sugerido:** "Ejecuta la Fase 2.3 de `MercadoTech_sesion2.md`: genera las políticas RLS."

Una migración dedicada. Actualizar `policies.sql` como referencia. Políticas:

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | dueño (y admin) | — (trigger) | solo dueño; `role` NO editable por el propio usuario (columna protegida vía política/trigger) | — |
| categories | todos (anon incluido) | solo admin | solo admin | solo admin |
| products | todos si `is_active`; el vendedor ve también los suyos inactivos | authenticated con `seller_id = auth.uid()` y rol seller | solo el vendedor dueño | solo el vendedor dueño |
| product_images | mismas condiciones de visibilidad que su producto | solo el vendedor dueño del producto | solo el vendedor dueño | solo el vendedor dueño |
| cart_items | solo dueño | solo dueño | solo dueño | solo dueño |
| orders | comprador dueño; vendedor si tiene ítems en el pedido (via order_items); admin | vía función `create_order_from_cart` (no INSERT directo del cliente) | vendedor solo puede avanzar `status` de pedidos con ítems suyos; comprador solo puede cancelar si 'pendiente' | — |
| order_items | comprador del pedido; vendedor de sus ítems; admin | solo vía función | — | — |
| questions | todos (producto público) | authenticated | solo el vendedor dueño del producto puede escribir `answer` | autor de la pregunta o admin |
| reviews | todos | comprador con pedido 'entregado' que contenga el producto (verificado en la política con EXISTS sobre orders + order_items) | solo autor | autor o admin |
| favorites | solo dueño | solo dueño | — | solo dueño |
| product_views | vendedor del producto o admin | authenticated | — | — |
| support_articles | todos si `is_published` | solo admin | solo admin | solo admin |
| support_tickets | dueño o admin | dueño (`user_id = auth.uid()`) | dueño (solo cerrar) o admin | — |
| ticket_messages | dueño del ticket o admin | dueño del ticket o admin | — | — |

Notas de implementación:

* Usar `(select auth.uid())` en las políticas (evita re-evaluación por fila).
* Para roles, función helper `is_admin()` / lectura del claim, con SECURITY
  DEFINER y `search_path` fijado — nunca subconsultas repetidas a profiles en caliente.
* Recordar los **GRANTs de la Data API**: `grant select/insert/update/delete`
  según corresponda a `anon` y `authenticated` (lección de ReadHub: RLS sin
  GRANT = errores opacos).

## Fase 2.4 — Storage: buckets y políticas

**Prompt sugerido:** "Ejecuta la Fase 2.4 de `MercadoTech_sesion2.md`: genera los buckets de Storage y sus políticas."

1. Bucket `product-images` (público para lectura): escritura/borrado solo del
   vendedor autenticado dentro de su propia carpeta — convención de path
   `{seller_id}/{product_id}/{n}.{ext}`, política sobre `storage.objects`
   comparando el primer segmento del path con `auth.uid()`.
2. Bucket `avatars` (público para lectura): escritura solo del dueño en
   `{user_id}/…`.
3. Límites recomendados por bucket: tipos MIME de imagen, tamaño máximo 5 MB.

## Fase 2.5 — Datos de prueba (`seed.sql`)

**Prompt sugerido:** "Ejecuta la Fase 2.5 de `MercadoTech_sesion2.md`: genera el `seed.sql`."

Usuarios (en `auth.users` + `profiles`, contraseña común de laboratorio, ej.
`MercadoTech123!`):

* 3 compradores (`buyer1@mercadotech.test`…), 2 vendedores, 1 admin.

Datos (respetando TODAS las restricciones):

* 8 categorías: Laptops, Smartphones, Componentes de PC, Audio, Gaming,
  Monitores, Accesorios, Redes.
* ~16 productos repartidos entre los 2 vendedores, con marca, condición y
  precios realistas en `numeric`; 2 productos inactivos y 1 con stock 0
  (para probar filtros y validación de checkout).
* `product_images`: 2-3 filas por producto con paths coherentes con la
  convención del bucket. **Documentar en el propio seed** que los archivos no
  existen en Storage hasta subirlos por la UI (gap conocido de ReadHub —
  dejarlo explícito desde el día uno).
* Pedidos: al menos 1 por cada estado (pendiente, pagado, enviado, entregado,
  cancelado), con sus `order_items` y snapshots correctos.
* Preguntas: mínimo 6 (algunas respondidas, otras no).
* Reseñas: solo sobre pedidos 'entregado' (coherentes con la política RLS).
* Favoritos y `product_views` de muestra.
* 10 artículos de soporte (FAQ) con contenido REAL y útil, en las 4 categorías
  ('envíos', 'pagos', 'devoluciones', 'cuenta') — serán la base del RAG de la
  sesión 4, así que deben tener 2-4 párrafos de contenido cada uno, no lorem ipsum.
* 2 tickets de soporte con mensajes.

## Fase 2.6 — Validación de políticas RLS

**Prompt sugerido:** "Ejecuta la Fase 2.6 de `MercadoTech_sesion2.md`: genera los scripts de validación RLS."

En `supabase/tests/rls-validation.sql` (o varios archivos por tabla): escenarios
ejecutables con `set local role` / `request.jwt.claims` simulando cada actor.
Cada prueba indica el **resultado esperado** (filas devueltas o error). Mínimo:

1. Anónimo: ve productos activos; NO ve carritos, pedidos ni tickets.
2. Comprador: ve/edita SU carrito; no puede tocar el de otro.
3. Comprador: no puede insertar reseña sin pedido 'entregado'; sí con él.
4. Vendedor: CRUD de SUS productos; no puede editar productos ajenos.
5. Vendedor: ve pedidos que contienen sus ítems; no ve pedidos ajenos.
6. Vendedor: puede responder preguntas SOLO de sus productos.
7. Usuario: no puede cambiar su propio `role`.
8. Admin: puede moderar (borrar pregunta/reseña, editar support_articles).
9. Checkout: `create_order_from_cart` falla con carrito vacío y con stock
   insuficiente; éxito descuenta stock y vacía carrito.

## Fase 2.7 — Documentación técnica

**Prompt sugerido:** "Ejecuta la Fase 2.7 de `MercadoTech_sesion2.md`: genera `docs/ARQUITECTURA.md`."

Contenido: arquitectura general y capas; organización de carpetas; modelo
relacional (diagrama de entidades en texto/mermaid); decisiones de diseño
(snapshots en order_items, checkout como función transaccional, seller_id
denormalizado en order_items para RLS, views como eventos); integración
Next.js ↔ Supabase; flujo de autenticación (middleware + cookies); estrategia
de escalabilidad; descripción de cada política RLS.

---

## Restricciones de la sesión (igual a 8.10 de ReadHub)

Esta sesión construye SOLO infraestructura. NO desarrollar:

* Pantallas de autenticación ni formularios.
* CRUD de productos desde la UI.
* Componentes de interfaz del dominio.
* Hooks personalizados ni servicios de negocio (más allá de los clientes Supabase).
* Endpoints de API.
* Carga real de archivos.
* Nada de IA, embeddings ni voz.

## Entregables

1. Proyecto Next.js 15 configurado con la estructura de carpetas completa.
2. Migraciones que reconstruyen la BD desde cero (`supabase db reset` limpio).
3. `schema.sql` y `policies.sql` de referencia actualizados.
4. RLS en todas las tablas + GRANTs correctos.
5. Buckets de Storage con políticas.
6. `seed.sql` completo y coherente.
7. Scripts de validación RLS con resultados esperados.
8. `docs/ARQUITECTURA.md`.

## Criterios de aceptación de la sesión

* `supabase db reset` aplica migraciones + seed sin errores.
* Todos los escenarios de la Fase 2.6 dan el resultado esperado.
* `npm run lint` y `tsc --noEmit` pasan.
* Ninguna tabla queda sin RLS habilitado.
