# MercadoTech — Sesión 3: UI Inteligente y Frontend Multimodal

## Este documento contiene la especificación completa de la sesión. Léelo completamente antes de generar cualquier código. No hagas suposiciones fuera de lo especificado.

**Prompts de la sesión (ejecutar en orden; versión completa y autocontenida de cada uno en `PROMPTS_sesion3.md`):**

0. "Ejecuta el Prompt 0 de `PROMPTS_sesion3.md`: provisiona el entorno (stack Supabase local, `.env.local`, dependencias y componentes shadcn)."
1. "Lee `mercadotech/MercadoTech_sesion3.md` completo y confírmame que entiendes el alcance. No generes código todavía."
2. "Ejecuta la Fase 3.1: tipos generados, sistema visual y componentes base."
3. "Ejecuta la Fase 3.2: layouts, navegación y mapa de rutas."
4. "Ejecuta la Fase 3.3: autenticación (migración de registro, service, hook y pantallas)."
5. "Ejecuta la Fase 3.4: catálogo de productos (listado, filtros, búsqueda por texto)."
6. "Ejecuta la Fase 3.5: detalle de producto con preguntas, reseñas y favoritos."
7. "Ejecuta la Fase 3.6: carrito, checkout simulado y mis pedidos."
8. "Ejecuta la Fase 3.7: panel del vendedor con drag & drop (galería y kanban de pedidos)."
9. "Ejecuta la Fase 3.8: revisión de responsive, accesibilidad y estados de carga/vacío/error."
10. "Ejecuta el Prompt de cierre de `PROMPTS_sesion3.md`: bitácora de la sesión en `docs/BITACORA.md` y actualización de `CLAUDE.md`."

---

## Objetivo general

Construir un MVP completamente funcional del marketplace sobre la infraestructura
de la sesión 2: todas las pantallas, navegación, hooks y servicios, con
separación estricta UI/lógica y dos interacciones drag & drop (galería del
producto y kanban de pedidos del vendedor).

## Objetivos específicos

* Integrar shadcn/ui y Tailwind sin fricción (sistema visual coherente).
* Convertir wireframes a código usando Vision (metodología, ver abajo).
* Crear componentes avanzados con drag & drop (dnd-kit).
* Modular TODA la lógica de estado con custom hooks.
* Mantener la independencia total entre componentes, hooks y services.

---

## Estado de partida (validado contra el repositorio)

Lo que existe al iniciar esta sesión (commits de la sesión 2):

| Ya existe | Dónde | Lo usa la fase |
|---|---|---|
| Proyecto Next.js 15 + Tailwind v4 + shadcn inicializado (`components.json`, `cn`) | raíz, `lib/utils.ts` | 3.1 |
| Clientes Supabase: browser, server, middleware (refresco de sesión), admin | `lib/supabase/` | 3.3+ |
| Roles y estados tipados | `lib/constants/roles.ts` | todas |
| 14 tablas con RLS + GRANTs, triggers de columnas protegidas | `supabase/migrations/` | 3.3–3.7 |
| RPC `create_order_from_cart(p_buyer_id)` (transaccional) | migración `..._create_checkout_function` | 3.6 |
| Buckets `product-images` y `avatars` (públicos para lectura, 5 MB, jpeg/png/webp) | migración `..._create_storage_buckets` | 3.4, 3.7 |
| Seed: 6 usuarios, 8 categorías, 16 productos, pedidos en los 5 estados, preguntas, reseñas | `supabase/seed.sql` | todas (datos de prueba) |

Pendiente de la sesión 2 (no bloquea esta sesión, pero conviene cerrarlo):
Fase 2.6 (`supabase/tests/` vacío) y Fase 2.7 (`docs/ARQUITECTURA.md` no existe).

Lo que NO existe y esta sesión crea desde cero: `types/` (vacío, sin
`database.ts`), `components/`, `hooks/`, `services/`, `lib/validators/`, y las
carpetas de rutas `(auth)`, `(shop)`, `(seller)` (solo tienen `.gitkeep`).

### Decisiones tomadas al validar la spec contra el esquema real

Cada una se detalla en la fase correspondiente; aquí el índice:

| # | Hallazgo | Resolución | Fase |
|---|---|---|---|
| 1 | Registrarse como `seller` es imposible vía cliente: `handle_new_user` fija `role='buyer'` y el trigger `protect_profile_role` bloquea que el usuario cambie su propio rol | Migración NUEVA que lee `role`/`display_name` de `raw_user_meta_data` | 3.3 |
| 2 | `(shop)/pedidos` y `(seller)/pedidos` resuelven ambas a `/pedidos`; `app/page.tsx` choca con `(shop)/page.tsx` → error de build | Panel vendedor bajo prefijo `/vendedor/...`; borrar `app/page.tsx` | 3.2 |
| 3 | El navbar (3.2) necesita hooks que nacen en 3.3, 3.4 y 3.6 | Componentes del navbar son puros; cada fase posterior los conecta | 3.2 |
| 4 | `getPublicUrl` está en 3.7 pero las imágenes se muestran desde 3.4 | `storage.service.ts` nace en 3.4 (solo `getPublicUrl`) y se amplía en 3.7 | 3.4 |
| 5 | Ninguna fase genera `types/database.ts` | Paso 1 de la Fase 3.1 | 3.1 |
| 6 | `numeric(12,2)` llega como `string` desde PostgREST | `Price` y services aceptan `number \| string`; se parsea en el service | 3.1 |
| 7 | `UserMenu` enlaza "favoritos" pero ninguna fase crea la página | `(shop)/favoritos/page.tsx` en 3.5 | 3.5 |
| 8 | `profiles` solo es legible por su dueño o admin → no hay nombres de otros usuarios | Mostrar "Comprador verificado"/"Usuario"; sin migración nueva (fuera de alcance) | 3.5 |
| 9 | El vendedor NO puede poner `cancelado` (RLS solo permite `pagado/enviado/entregado`); RLS no valida la secuencia, solo el destino | Columna "Cancelado" de solo lectura; la secuencia la impone el hook | 3.7 |
| 10 | `deleteProduct` falla si el producto tiene ventas (`order_items.product_id` es `on delete restrict`) | Mostrar error claro y sugerir "desactivar" | 3.7 |
| 11 | Cancelar un pedido NO restaura stock (no hay trigger) | Limitación conocida, documentada en la UI; fuera de alcance | 3.6 |
| 12 | El path de Storage exige `product_id` → no se puede subir antes de crear el producto | "Publicar" crea el producto primero; el reorden es local hasta el submit | 3.7 |
| 13 | Las imágenes del seed no existen en Storage (404 documentado) | `ProductImage` con placeholder ante error de carga | 3.1 |
| 14 | `product_views` exige sesión (`user_id not null`) | `registerView` solo con usuario autenticado | 3.5 |

---

## Mapa de fases y dependencias

| Fase | Qué entrega (en una línea) | Depende de | Se verifica con |
|---|---|---|---|
| 3.1 | Tipos generados, tokens de tema, shadcn instalado, 7 componentes base puros | sesión 2 | página de muestra `/dev/ui` renderiza todos los componentes |
| 3.2 | Layouts `(shop)`/`(seller)`/`(auth)`, navbar y sidebar puros, mapa de rutas | 3.1 | todas las rutas del mapa responden (aunque vacías) |
| 3.3 | Migración de registro, `auth.service`, `useAuth`, login/registro, rutas protegidas | 3.2 | registro como seller → `profiles.role = 'seller'`; login con usuarios del seed |
| 3.4 | `product.service`, `category.service`, `useProducts`, home con grid + filtros + búsqueda | 3.3 | 14 productos activos del seed visibles; filtros cambian la URL |
| 3.5 | Detalle con galería, BuyBox, Q&A, reseñas verificadas, favoritos | 3.4 | comprador con pedido entregado ve el formulario de reseña; otro no |
| 3.6 | Carrito persistente, checkout vía RPC, mis pedidos, cancelar | 3.5 | checkout descuenta stock y vacía carrito; stock 0 muestra qué producto falló |
| 3.7 | CRUD vendedor, galería drag & drop, kanban drag & drop | 3.6 | reorden persiste en `position`; mover tarjeta cambia `orders.status` |
| 3.8 | Pasada de responsive, a11y, skeleton/vacío/error en TODAS las pantallas | 3.7 | checklist de la fase en verde + grep de capas limpio |

---

## Convenciones transversales (aplican a todas las fases)

### Patrón de service (cliente inyectable)

```ts
// services/product.service.ts
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export async function getProductById(id: string, supabase: Client = createClient()) {
  const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}
```

* Services: funciones puras async, reciben el cliente como ÚLTIMO parámetro
  con default al cliente de navegador. No importan React. Lanzan el error de
  Supabase tal cual (el hook lo traduce a estado).
* Hooks: `useState/useEffect` + llamadas a services. Exponen
  `{data, loading, error, acciones}`. Cero reglas de negocio propias salvo
  las que la spec asigna explícitamente al hook (ej. transiciones del kanban).
* Componentes: solo props. Prohibido importar `@/lib/supabase/*`, `services/*`
  o `hooks/*` desde `components/`. Las páginas (`app/**/page.tsx`) son el único
  punto donde un hook se conecta con componentes.

### Datos que llegan "raros" desde PostgREST

* `numeric(12,2)` (`price`, `total`, `price_snapshot`) llega como **`string`**.
  Los services lo convierten con `Number()` al mapear a tipos de dominio; los
  componentes reciben `number`.
* `product_images` viene anidado y sin ordenar: el service ordena por
  `position` y expone `image_url` (ya resuelta) además de `image_path`.
* Un producto inactivo dentro de un carrito llega con `products: null` (RLS lo
  oculta): la UI lo muestra como "ya no disponible".

### Imágenes

* URL pública: `{NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/{image_path}`.
  La construye `storage.service.getPublicUrl` (3.4); los componentes reciben
  la URL final, nunca el path.
* `next.config.ts` debe declarar `images.remotePatterns` para el host de
  Supabase (local `127.0.0.1:54321` y el hosted) — se hace en 3.1.
* Las imágenes del seed NO existen en Storage: todo `<Image>` de producto pasa
  por `ProductImage`, que muestra un placeholder si la carga falla.

### Tunables nuevos en `lib/constants/` (regla 5 del CLAUDE.md)

| Archivo | Contenido | Fase |
|---|---|---|
| `catalog.ts` | `PRODUCTS_PAGE_SIZE = 12` (múltiplo de 2/3/4 columnas), `SORT_OPTIONS`, límites del rango de precio | 3.4 |
| `product.ts` | `TITLE_MIN = 5`, `TITLE_MAX = 120`, `MAX_IMAGES_PER_PRODUCT = 6`, `MAX_IMAGE_BYTES = 5 MB` (= bucket), `ALLOWED_IMAGE_TYPES` (= bucket) | 3.7 |
| `orders.ts` | `ORDER_STATUS_FLOW` (secuencia), `ORDER_STATUS_LABELS`, colores de badge por estado | 3.6 |

Cada valor lleva un comentario que justifica su elección.

### Metodología Vision (transversal a todas las fases de pantallas)

Antes de construir cada pantalla se puede adjuntar un wireframe (foto de un
boceto a mano o captura de una referencia). El prompt patrón es:

> "Aquí está el wireframe de [pantalla]. Conviértelo a código usando NUESTROS
> componentes base de la Fase 3.1 y los tokens del sistema visual. No inventes
> componentes nuevos si ya existe uno equivalente. La pantalla no hace fetching:
> recibe todo por props/hook."

Si no hay wireframe, usar como referencia la disposición típica de Mercado
Libre (grid de cards, ficha de producto con galería a la izquierda y caja de
compra a la derecha).

### Reutilización de la infraestructura existente

* NO modificar migraciones existentes ni `seed.sql` ni políticas RLS.
* Sí se permite AGREGAR migraciones nuevas si una pantalla lo exige y se
  justifica. En esta sesión la única prevista es la de la Fase 3.3.
* Todo acceso a datos pasa por `services/` con el cliente de navegador (RLS
  aplica siempre). NO construir capa REST paralela para el CRUD: los Route
  Handlers de `app/api/v1/` quedan reservados para lo que no puede correr en el
  navegador (sesión 4 en adelante).

---

# FASES

## Fase 3.1 — Tipos generados, sistema visual y componentes base

**Prompt sugerido:** "Ejecuta la Fase 3.1 de `MercadoTech_sesion3.md`."

### Qué se construye

La base técnica y visual sobre la que se apoyan todas las pantallas: los tipos
TypeScript generados desde la BD, el tema (colores/radios/tipografía) y un
conjunto pequeño de componentes de presentación reutilizables. **No hay
pantallas ni datos reales todavía**; solo una página de muestra para verlos.

### Depende de

Sesión 2 completa hasta la Fase 2.5 (Supabase local levantado con `supabase start`).

### Archivos

| Archivo | Responsabilidad |
|---|---|
| `types/database.ts` | Generado por `supabase gen types typescript --local`. NO se edita a mano. |
| `types/product.ts`, `types/order.ts`, `types/user.ts`, `types/question.ts`, `types/review.ts` | Tipos de dominio derivados de `Database['public']['Tables'][...]['Row']` + campos calculados (`image_url`, `price: number`, `average_rating`). |
| `package.json` | Script `db:types` → `supabase gen types typescript --local > types/database.ts` (lo agrega el Prompt 0; aquí solo se ejecuta). |
| `app/globals.css` | Tokens de tema claro/oscuro: primario azul eléctrico (marketplace tech), radios, tipografía. Reemplaza los valores neutros por defecto de shadcn. |
| `next.config.ts` | `images.remotePatterns` para Supabase local y hosted. |
| `components/ui/*` | Instalados por shadcn en el Prompt 0: `button`, `card`, `input`, `label`, `textarea`, `select`, `badge`, `dialog`, `dropdown-menu`, `avatar`, `separator`, `skeleton`, `tabs`, `sheet`, `sonner`, `table`. En esta fase solo se verifica que estén; se instala lo que falte. |
| `lib/utils.ts` | Añadir `formatPrice(value: number \| string): string` → `S/ 1,299.90` (`Intl.NumberFormat('es-PE', {currency: 'PEN'})`). Pura, sin React. |
| `components/shared/Price.tsx` | Muestra `formatPrice`. Props: `value`, `size`. |
| `components/shared/RatingStars.tsx` | 1–5 estrellas; modo solo lectura (`value`) y editable (`onChange`), accesible por teclado. |
| `components/shared/ConditionBadge.tsx` | `Badge` con color por `ProductCondition` (nuevo/usado/reacondicionado). |
| `components/shared/ProductImage.tsx` | Wrapper de `next/image` con `alt` obligatorio y placeholder si la imagen falla (ver decisión 13). |
| `components/shared/EmptyState.tsx`, `ErrorState.tsx`, `LoadingState.tsx` | Estados estándar. `EmptyState` recibe `action` opcional; `ErrorState` recibe `onRetry`. |
| `components/shared/Container.tsx` | Ancho máximo + padding responsive. |
| `app/dev/ui/page.tsx` | Página de muestra con todos los componentes base en sus variantes. Se borra en la Fase 3.8. |

### Reglas

* Ninguno de estos componentes importa Supabase, services ni hooks — solo props.
* `Price` acepta `number | string` (ver convención de `numeric`).
* Los tokens van en `globals.css` con variables CSS; no se hardcodean colores
  en los componentes.

### Cómo verificar al terminar

* `types/database.ts` existe y contiene las 14 tablas y la función
  `create_order_from_cart`.
* `/dev/ui` muestra todos los componentes en tema claro y oscuro.
* `npm run lint` y `npm run type-check` pasan.

## Fase 3.2 — Layouts, navegación y mapa de rutas

**Prompt sugerido:** "Ejecuta la Fase 3.2 de `MercadoTech_sesion3.md`."

### Qué se construye

El esqueleto de navegación de toda la app: los tres layouts (tienda, vendedor,
auth), el navbar y el sidebar como componentes **puros**, y TODAS las rutas del
mapa creadas como páginas placeholder ("Próximamente — Fase 3.x"). Al terminar
se puede navegar la app completa aunque ninguna pantalla tenga datos.

### Depende de

3.1 (componentes base y tema).

### Mapa de rutas (definitivo para la sesión)

| URL | Archivo | Grupo | Acceso | Se implementa en |
|---|---|---|---|---|
| `/` | `app/(shop)/page.tsx` | shop | público | 3.4 |
| `/buscar?q=` | `app/(shop)/buscar/page.tsx` | shop | público | 3.4 (la sesión 4 le añade la pestaña de IA) |
| `/categoria/[slug]` | `app/(shop)/categoria/[slug]/page.tsx` | shop | público | 3.4 |
| `/producto/[id]` | `app/(shop)/producto/[id]/page.tsx` | shop | público (acciones requieren sesión) | 3.5 |
| `/favoritos` | `app/(shop)/favoritos/page.tsx` | shop | sesión | 3.5 |
| `/carrito` | `app/(shop)/carrito/page.tsx` | shop | sesión | 3.6 |
| `/pedidos` | `app/(shop)/pedidos/page.tsx` | shop | sesión | 3.6 |
| `/pedidos/[id]` | `app/(shop)/pedidos/[id]/page.tsx` | shop | sesión (comprador dueño) | 3.6 |
| `/vendedor/productos` | `app/(seller)/vendedor/productos/page.tsx` | seller | rol seller/admin | 3.7 |
| `/vendedor/publicar` | `app/(seller)/vendedor/publicar/page.tsx` | seller | rol seller/admin | 3.7 |
| `/vendedor/productos/[id]/editar` | `app/(seller)/vendedor/productos/[id]/editar/page.tsx` | seller | rol seller/admin | 3.7 |
| `/vendedor/pedidos` | `app/(seller)/vendedor/pedidos/page.tsx` | seller | rol seller/admin | 3.7 |
| `/login` | `app/(auth)/login/page.tsx` | auth | público | 3.3 |
| `/register` | `app/(auth)/register/page.tsx` | auth | público | 3.3 |

Decisiones 2 y 3 del índice:

* El panel del vendedor vive bajo el prefijo `/vendedor/` para que
  `/pedidos` (comprador) y `/vendedor/pedidos` (vendedor) no colisionen.
* `app/page.tsx` (página por defecto de `create-next-app`) se **elimina** en
  esta fase: su lugar lo ocupa `app/(shop)/page.tsx`.
* "Soporte" NO aparece en el menú hasta la sesión 4 (la ruta `/soporte` no existe aún).

### Archivos

| Archivo | Responsabilidad |
|---|---|
| `app/layout.tsx` | Raíz: fuentes, `<Toaster />` de sonner, metadata real ("MercadoTech"), `lang="es"`. |
| `app/(shop)/layout.tsx` | `Navbar` arriba + `Container` + footer mínimo. |
| `app/(seller)/layout.tsx` | `SellerSidebar` a la izquierda (colapsable en móvil). La protección por rol se conecta en 3.3. |
| `app/(auth)/layout.tsx` | Centrado, sin navbar, con logo. |
| `components/layout/Navbar.tsx` | Compone: logo, `SearchBar`, `CategoriesMenu`, `CartIndicator`, `UserMenu`, `MobileNav`. Todo por props. |
| `components/layout/SearchBar.tsx` | Input + submit; `onSearch(query)`. Navega a `/buscar?q=`. Deja un comentario: "la búsqueda semántica (toggle) llega en la sesión 4". |
| `components/layout/CategoriesMenu.tsx` | `dropdown-menu` con `categories: Category[]` por props. |
| `components/layout/CartIndicator.tsx` | Ícono + `count` por props. |
| `components/layout/UserMenu.tsx` | `avatar` + menú: Mis pedidos, Favoritos, Panel vendedor (si `role` es seller/admin), Cerrar sesión. Si no hay usuario: botón "Ingresar". Props: `user`, `onLogout`. |
| `components/layout/MobileNav.tsx` | `sheet` con los mismos enlaces para < md. |
| `components/layout/SellerSidebar.tsx` | Enlaces: Mis productos, Pedidos, Publicar. |
| `components/layout/NavLink.tsx` | Enlace con estado activo (`usePathname`). |
| Todas las páginas del mapa | Placeholder con `EmptyState` "Próximamente (Fase 3.x)". |

### Cómo se conectan los componentes del navbar (decisión 3)

En esta fase el layout les pasa valores estáticos (`categories=[]`,
`count=0`, `user=null`). Cada fase posterior los conecta con su hook:

| Componente | Hook que lo alimenta | Fase |
|---|---|---|
| `UserMenu` | `useAuth` | 3.3 |
| `CategoriesMenu` | `useCategories` | 3.4 |
| `CartIndicator` | `useCart` (contador) | 3.6 |
| `(seller)/layout` (guard de rol) | `useAuth` | 3.3 |

### Cómo verificar al terminar

* `npm run build` pasa (sin rutas duplicadas).
* Las 14 URLs del mapa responden con su placeholder en móvil y desktop.
* `MobileNav` abre/cierra con teclado.

## Fase 3.3 — Autenticación

**Prompt sugerido:** "Ejecuta la Fase 3.3 de `MercadoTech_sesion3.md`."

### Qué se construye

Registro (con elección de rol comprador/vendedor), inicio y cierre de sesión,
el hook global de sesión y la protección de rutas. Al terminar, `UserMenu`
muestra al usuario real y el layout del vendedor rechaza a quien no es seller.

### Depende de

3.2 (layouts y `UserMenu` puro).

### Migración nueva obligatoria (decisión 1)

`supabase/migrations/<timestamp>_handle_new_user_metadata.sql`:
`create or replace function public.handle_new_user()` que lea de
`new.raw_user_meta_data`:

* `display_name`: si viene vacío, prefijo del email (comportamiento actual).
* `role`: solo se acepta `'buyer'` o `'seller'`; cualquier otro valor (incluido
  `'admin'` o ausente) → `'buyer'`. **Nunca admin desde el registro.**

Justificación en el comentario SQL: el trigger `protect_profile_role` (Fase 2.3)
impide que el usuario actualice su propio `role` después de creado, así que el
único momento en que puede fijarse es en el INSERT del trigger. No se toca el
archivo original de la Fase 2.2; se reemplaza la función desde una migración
nueva. Actualizar `schema.sql` de referencia.

### Archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/validators/auth.ts` | `validateLogin`, `validateRegister` (email válido, password ≥ 8, display_name 2–60, role ∈ buyer/seller). Puras, sin React. |
| `services/auth.service.ts` | `register({email, password, displayName, role})` → `signUp` con `options.data = {display_name, role}`; `login`, `logout`, `getCurrentUser()` (user de auth + su fila de `profiles`). |
| `hooks/useAuth.ts` | Estado `{user, profile, initializing, loading, error}` + acciones. Escucha `onAuthStateChange`; al cambiar, recarga el profile. |
| `components/auth/LoginForm.tsx`, `RegisterForm.tsx` | Puros: reciben `onSubmit`, `loading`, `error`; validan con `lib/validators/auth.ts` antes de enviar. `RegisterForm` tiene el selector "Quiero comprar / Quiero vender". |
| `app/(auth)/login/page.tsx`, `register/page.tsx` | Conectan hook ↔ formulario; leen `redirectTo` de la URL. |
| `lib/supabase/middleware.ts` | AMPLIAR: tras `getUser()`, si la ruta empieza por `/carrito`, `/pedidos`, `/favoritos` o `/vendedor` y no hay usuario → redirigir a `/login?redirectTo=<ruta>`. |
| `app/(seller)/layout.tsx` | CONECTAR guard de rol: si `profile.role` no es seller/admin → toast "Necesitas una cuenta de vendedor" + redirect a `/`. |
| `app/(shop)/layout.tsx` | CONECTAR `UserMenu` con `useAuth`. |

### Reglas de navegación

* Usuario anónimo: navega catálogo y detalle libremente.
* Carrito, checkout, favoritos, pedidos, preguntar, reseñar y panel vendedor
  requieren sesión: el middleware redirige a `/login?redirectTo=` (sin
  parpadeo). Las acciones dentro del detalle (preguntar, favorito, agregar al
  carrito) muestran el botón y redirigen al hacer clic si no hay sesión.
* Tras login/registro exitoso: `router.push(redirectTo ?? '/')`.
* Supabase local tiene `enable_confirmations = false` → el registro inicia
  sesión de inmediato. En un proyecto hosted con confirmación activa, mostrar
  "revisa tu correo" si `session` viene null.

### Cómo verificar al terminar

* Registrar `nuevo-seller@test.com` con "Quiero vender" → en Studio,
  `profiles.role = 'seller'` y `display_name` correcto.
* Registrar con `role: 'admin'` manipulado desde DevTools → queda `'buyer'`.
* Login con los usuarios del seed (contraseña `MercadoTech123!`):
  `buyer1@mercadotech.test`, `seller1@mercadotech.test`, `admin@mercadotech.test`.
* `buyer1` entrando a `/vendedor/productos` → toast + redirect.
* Anónimo entrando a `/carrito` → `/login?redirectTo=/carrito`.

## Fase 3.4 — Catálogo de productos

**Prompt sugerido:** "Ejecuta la Fase 3.4 de `MercadoTech_sesion3.md`."

### Qué se construye

La home con el grid de productos, la página por categoría, la búsqueda por
texto y el panel de filtros. Es la primera fase con datos reales del seed en
pantalla.

### Depende de

3.3 (`useAuth` para saber si hay sesión; no es obligatorio para navegar).

### Archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/constants/catalog.ts` | `PRODUCTS_PAGE_SIZE`, `SORT_OPTIONS` (`recientes`, `precio_asc`, `precio_desc`), rango de precio por defecto. |
| `services/storage.service.ts` | Nace aquí con solo `getPublicUrl(bucket, path)` (decisión 4). Se amplía en 3.7. |
| `services/category.service.ts` | `listCategories()` ordenadas por nombre. |
| `services/product.service.ts` | `listActiveProducts({categorySlug, search, condition, minPrice, maxPrice, sort, page})` → `{items, total}`; `getProductById(id)`; `getProductImages(productId)` ordenadas por `position`. Mapea `price` a `number`, resuelve `image_url` de la portada (menor `position`) y calcula `average_rating`/`review_count` desde `reviews(rating)`. |
| `hooks/useCategories.ts` | Lista de categorías (cache simple en memoria). |
| `hooks/useProducts.ts` | Lee filtros de `useSearchParams`, llama al service, expone `{items, total, page, loading, error, setFilter, setPage, retry}`. Cambiar un filtro escribe la URL (estado compartible) y vuelve a página 1. |
| `components/catalog/ProductCard.tsx` | Imagen (`ProductImage`), título, `Price`, `ConditionBadge`, `RatingStars` si `review_count > 0`. Link a `/producto/[id]`. |
| `components/catalog/ProductGrid.tsx` | Grid responsive (1/2/3/4 columnas) + `ProductCardSkeleton` ×N durante carga + `EmptyState` si no hay resultados. |
| `components/catalog/FiltersPanel.tsx` | Condición (checkbox múltiple), rango de precio (min/max), orden. Puro: `value` + `onChange`. En móvil va dentro de un `sheet`. |
| `components/catalog/Pagination.tsx` | Anterior/Siguiente + "Página X de Y". |
| `app/(shop)/page.tsx` | Home: `FiltersPanel` + `ProductGrid` + `Pagination` vía `useProducts`. |
| `app/(shop)/categoria/[slug]/page.tsx` | MISMO grid y hook, con `categorySlug` fijado desde el segmento de ruta. Título = nombre de la categoría. |
| `app/(shop)/buscar/page.tsx` | MISMO grid y hook, con `search` desde `?q=`. Título "Resultados para «q»". |
| `app/(shop)/layout.tsx` | CONECTAR `CategoriesMenu` ↔ `useCategories` y `SearchBar` → `/buscar?q=`. |

### Reglas

* Búsqueda por texto: `ilike` sobre `title` y `brand` (`or(...)`). Es
  provisional hasta la búsqueda semántica de la sesión 4 — dejar comentario.
* Paginación con `.range()` + `count: 'exact'`.
* Solo productos `is_active = true` (RLS ya lo garantiza para anónimos; el
  filtro explícito evita que un vendedor vea los suyos inactivos en la home).
* `ProductCard` no conoce Supabase: recibe `image_url` ya resuelta.

### Cómo verificar al terminar

* Home muestra los 14 productos activos del seed (2 están inactivos) en 2 páginas.
* `/categoria/laptops` filtra; `/buscar?q=asus` encuentra por marca.
* Cambiar orden/condición actualiza la URL y se puede compartir/recargar.
* Producto con stock 0 (`b0000000-…06`) aparece en el grid (sigue activo).
* Sin imágenes en Storage, cada card muestra el placeholder, no un ícono roto.

## Fase 3.5 — Detalle de producto, preguntas, reseñas y favoritos

**Prompt sugerido:** "Ejecuta la Fase 3.5 de `MercadoTech_sesion3.md`."

### Qué se construye

La ficha del producto completa (galería, info, caja de compra), la sección de
preguntas y respuestas, la de reseñas verificadas, el botón de favorito y la
página "Mis favoritos". "Agregar al carrito" queda cableado a un callback que
la Fase 3.6 implementa.

### Depende de

3.4 (`getProductById`, `getProductImages`, `useAuth`).

### Archivos

| Archivo | Responsabilidad |
|---|---|
| `services/product.service.ts` | AÑADIR `registerView(productId, userId)` (insert en `product_views`). |
| `services/question.service.ts` | `listByProduct(productId)`, `create(productId, userId, question)`, `answer(questionId, answer)` (update `answer` + `answered_at = now()`). |
| `services/review.service.ts` | `listByProduct`, `getAverage(productId)` → `{average, count}`, `canReview(productId, userId)` → `{allowed, orderId \| null}` (busca un pedido `entregado` del usuario con ese producto y verifica que aún no tenga reseña), `create({productId, orderId, rating, comment})`. |
| `services/favorite.service.ts` | `isFavorite`, `toggle`, `listMine()` (join a products para mostrar cards). |
| `hooks/useProduct.ts` | Producto + imágenes; dispara `registerView` al montar solo si hay sesión (fire-and-forget, `catch` silencioso). |
| `hooks/useQuestions.ts` | Lista + `ask` + `answer` con actualización optimista. |
| `hooks/useReviews.ts` | Lista + promedio + `canReview` + `submit`. |
| `hooks/useFavorite.ts` | Estado por producto + `toggle`. |
| `hooks/useFavorites.ts` | Lista completa para `/favoritos`. |
| `components/product/ProductGallery.tsx` | Imagen grande + miniaturas ordenadas por `position`; teclado ←/→. |
| `components/product/ProductInfo.tsx` | Título, marca, `ConditionBadge`, `Price`, stock disponible. |
| `components/product/BuyBox.tsx` | Selector de cantidad (1..stock), "Agregar al carrito", botón favorito. Deshabilitado (con motivo visible) si stock 0, producto propio o inactivo. |
| `components/product/QuestionsSection.tsx` | Lista Q&A + formulario "Preguntar" (si hay sesión; si no, botón que lleva a login). Si `isOwner`, input inline para responder. |
| `components/product/ReviewsSection.tsx` | `RatingStars` promedio + lista; formulario SOLO si `canReview.allowed`. |
| `app/(shop)/producto/[id]/page.tsx` | Compone todo con los hooks. Pasa `isOwner = profile?.id === product.seller_id`. |
| `app/(shop)/favoritos/page.tsx` | Grid de `ProductCard` de `listMine` (decisión 7). |

### Reglas y restricciones del esquema

* **Reseñas verificadas:** `create` DEBE enviar `order_id` (la política RLS
  lo cruza con `orders.status = 'entregado'` y `order_items.product_id`). El
  hook solo muestra el formulario si `canReview.allowed` — defensa en
  profundidad, la RLS lo garantiza de todos modos.
* **Sin nombres de otros usuarios (decisión 8):** `profiles` solo es legible
  por su dueño. Las preguntas muestran "Usuario" y las reseñas "Comprador
  verificado" + fecha. Mostrar el nombre del vendedor/autor requeriría una
  vista `public_profiles` (migración nueva) — queda fuera de alcance de esta
  sesión; dejar comentario en el componente.
* **Vista de producto (decisión 14):** `product_views.user_id` es `not null` y
  la política exige `authenticated` → `registerView` solo con sesión.
* `answer` solo funciona si el usuario es el `seller_id` del producto (RLS +
  trigger `lock_question_immutable_fields` bloquean todo lo demás).

### Cómo verificar al terminar

* `buyer1` en `b0000000-…01` (pedido `c…01` entregado) NO ve el formulario:
  ya dejó su reseña (unique por comprador/producto) y se muestra como suya.
  Caso positivo: en Studio, `update orders set status = 'entregado' where id =
  'c0000000-…03'` → `buyer2` ve el formulario en `b…09`; `buyer3` no.
* `seller1` en un producto suyo ve el input de respuesta en las preguntas sin
  responder; en uno de `seller2` no.
* Favorito persiste al recargar; `/favoritos` lo lista.
* Con sesión, abrir un producto inserta una fila en `product_views` (verificar
  en Studio); sin sesión no falla nada.

## Fase 3.6 — Carrito, checkout simulado y mis pedidos

**Prompt sugerido:** "Ejecuta la Fase 3.6 de `MercadoTech_sesion3.md`."

### Qué se construye

El carrito persistente (tabla `cart_items`), el checkout que llama al RPC
transaccional de la sesión 2, y las pantallas de pedidos del comprador. Se
conecta el `CartIndicator` del navbar y el botón "Agregar al carrito" del BuyBox.

### Depende de

3.5 (`BuyBox`), RPC `create_order_from_cart`.

### Archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/constants/orders.ts` | `ORDER_STATUS_FLOW = ['pendiente','pagado','enviado','entregado']`, `ORDER_STATUS_LABELS`, variante de `Badge` por estado. |
| `services/cart.service.ts` | `getItems(userId)` (join a `products` + portada: precio y stock ACTUALES), `addItem(userId, productId, qty)` (si ya existe suma cantidad — `unique(user_id, product_id)` — y la limita al stock), `updateQuantity`, `removeItem`, `clear`. |
| `services/order.service.ts` | `checkout(userId)` → `rpc('create_order_from_cart', {p_buyer_id})` devuelve `orderId`; `listMyOrders(userId)`; `getOrderById(id)` con `order_items`; `cancelIfPending(id)` (update `status='cancelado'` where `status='pendiente'`). |
| `hooks/useCart.ts` | `{items, subtotal, count, loading, error, add, update, remove, checkout}`. `subtotal` se calcula con el precio ACTUAL del producto (el snapshot se fija en el RPC). |
| `hooks/useOrders.ts` | Lista y detalle; `cancel`. |
| `components/cart/CartItemRow.tsx` | Imagen, título, `Price`, cantidad editable (1..stock), quitar. Si `product` es null (inactivo, RLS lo oculta) → fila "ya no disponible" con botón quitar. |
| `components/cart/CartSummary.tsx` | Subtotal, texto "Pago simulado para el laboratorio — no se cobra", botón "Finalizar compra". |
| `components/orders/OrderStatusBadge.tsx` | `Badge` coloreado por estado. |
| `components/orders/OrderCard.tsx`, `OrderItemsTable.tsx` | Lista y detalle con snapshots (`title_snapshot`, `price_snapshot`). |
| `app/(shop)/carrito/page.tsx` | `CartItemRow` ×N + `CartSummary`. Checkout → toast éxito → `router.push('/pedidos/[id]')`. |
| `app/(shop)/pedidos/page.tsx`, `pedidos/[id]/page.tsx` | Lista con badge; detalle con ítems, total, estado y "Cancelar pedido" solo si `pendiente`. |
| `app/(shop)/layout.tsx` | CONECTAR `CartIndicator` ↔ `useCart().count`. |
| `app/(shop)/producto/[id]/page.tsx` | CONECTAR `BuyBox.onAddToCart` ↔ `useCart().add`. |

### Reglas

* **El checkout es SIMULADO:** comentario en código y texto en la UI. No se
  pide ni almacena ningún dato de pago.
* **Errores del RPC:** el mensaje de Postgres ya dice qué producto falló
  (`Stock insuficiente para "X": disponible N, solicitado M` / `El producto
  "X" ya no está disponible` / `El carrito está vacío`). El service lo
  propaga tal cual; el hook lo muestra en toast y **recarga el carrito** (el
  stock pudo cambiar).
* Tras checkout exitoso el RPC ya vació el carrito: el hook solo refresca.
* **Cancelar no restaura stock (decisión 11):** no hay trigger para ello.
  Mostrar nota "el stock no se repone automáticamente" en el diálogo de
  confirmación. Fuera de alcance de esta sesión.
* El comprador ve cambios de estado hechos por el vendedor al recargar (no hay
  realtime en esta sesión).

### Cómo verificar al terminar

* Agregar dos veces el mismo producto → una sola fila con cantidad sumada.
* Checkout con carrito normal → pedido `pendiente`, stock descontado en
  `products`, `cart_items` vacío, redirect a `/pedidos/[id]`.
* Checkout con `b0000000-…06` (stock 0) en el carrito → toast con el nombre
  del producto; no se crea pedido.
* Cancelar un pedido `pendiente` cambia a `cancelado`; en uno `pagado` el
  botón no aparece (y si se fuerza, RLS lo rechaza).
* `buyer2` no puede abrir `/pedidos/<id de buyer1>` (404 / `ErrorState`).

## Fase 3.7 — Panel del vendedor con drag & drop

**Prompt sugerido:** "Ejecuta la Fase 3.7 de `MercadoTech_sesion3.md`."

Instalar `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
(mantenido y accesible).

### Qué se construye

Todo el lado vendedor: tabla de mis productos, formulario de publicar/editar
con galería reordenable por arrastre, y el kanban de pedidos donde arrastrar
una tarjeta cambia su estado.

### Depende de

3.6 (pedidos existentes), `storage.service` (3.4), guard de rol (3.3).

### Archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/constants/product.ts` | Límites de validación y de imágenes (ver tabla de tunables). |
| `lib/validators/product.ts` | `validateProduct`: título 5–120, precio > 0, stock ≥ 0, categoría obligatoria, ≥ 1 imagen. Pura. |
| `services/seller.service.ts` | `listMyProducts(sellerId)` (incluye inactivos — la RLS lo permite al dueño), `createProduct`, `updateProduct`, `toggleActive`, `deleteProduct`, `listMyOrders(sellerId)` (pedidos con ítems propios), `updateOrderStatus(orderId, status)`. |
| `services/storage.service.ts` | AÑADIR `uploadProductImage(file, sellerId, productId, n)` → path `{seller_id}/{product_id}/{n}.{ext}`, `deleteProductImage(path)` (Storage + fila en `product_images`), `saveImageOrder(items: {id, product_id, image_path, position}[])` (upsert con filas completas — un upsert parcial viola los `not null`). |
| `hooks/useSellerProducts.ts` | Lista + `toggleActive` + `remove`. |
| `hooks/useProductForm.ts` | Estado del formulario, validación, imágenes locales (`File[]` + previews) y persistidas, submit en dos pasos (ver reglas), `reorder`. |
| `hooks/useSellerOrders.ts` | Pedidos agrupados por estado; `move(orderId, toStatus)` con validación de transición, actualización optimista y rollback. |
| `components/seller/ProductsTable.tsx` | `table`: portada, título, `Price`, stock, estado (`Badge`), acciones (editar, activar/desactivar, eliminar). |
| `components/seller/ProductForm.tsx` | Campos + `SortableImageGallery`. Puro: `value`, `errors`, `onChange`, `onSubmit`. |
| `components/seller/SortableImageGallery.tsx` | **Drag & drop #1.** Miniaturas reordenables (`@dnd-kit/sortable`), botón quitar, input múltiple de archivos. La primera es la portada (etiqueta "Portada"). Soporte de teclado activado (`KeyboardSensor`). |
| `components/seller/OrdersKanban.tsx`, `OrderKanbanCard.tsx` | **Drag & drop #2.** Columnas `pendiente → pagado → enviado → entregado` + columna `cancelado` aparte. Tarjeta: id corto, fecha, ítems propios, total de MIS ítems. |
| `app/(seller)/vendedor/productos/page.tsx` | `ProductsTable`. |
| `app/(seller)/vendedor/publicar/page.tsx`, `productos/[id]/editar/page.tsx` | Comparten `ProductForm` + `useProductForm` (modo `create` / `edit`). |
| `app/(seller)/vendedor/pedidos/page.tsx` | `OrdersKanban` + `useSellerOrders`. |

### Reglas — galería (decisión 12)

* El path de Storage exige `product_id`, así que en modo **create** el flujo es:
  1. Validar formulario (incluye ≥ 1 imagen local).
  2. `createProduct` → obtiene `id`.
  3. Subir las imágenes en el orden actual → insertar `product_images` con
     `position = índice`.
  4. Redirigir a editar (o a la tabla) con toast.
  Mientras tanto el reorden es LOCAL (previews con `URL.createObjectURL`).
* En modo **edit** las imágenes ya existen: al soltar, el hook llama a
  `saveImageOrder` de inmediato; nuevas imágenes se suben al instante con
  `n = max(n) + 1`; quitar borra en Storage y en la tabla.
* Validar tipo y tamaño en el cliente con los mismos límites del bucket (5 MB,
  jpeg/png/webp) para dar un error legible antes de que Storage lo rechace.

### Reglas — kanban (decisión 9)

* La RLS permite al vendedor poner `pagado`, `enviado` o `entregado` en
  pedidos con ítems suyos, **pero no valida el orden** (aceptaría
  `entregado → pagado`). El hook rechaza cualquier transición que no sea
  "un paso adelante" en `ORDER_STATUS_FLOW` y muestra toast explicativo.
* El vendedor **no puede cancelar** (RLS); la columna "Cancelado" es de solo
  lectura: muestra los pedidos que canceló el comprador y no acepta drops.
* Actualización optimista: mover la tarjeta en el estado local, llamar a
  `updateOrderStatus`, y si falla (RLS, red) revertir + toast.
* Pedido multi-vendedor (`c0000000-…04` del seed): cada vendedor solo ve SUS
  ítems; el total de la tarjeta es la suma de sus ítems, no `orders.total`.
  Mover el estado afecta al pedido completo — limitación del modelo, dejar
  comentario.

### Reglas — tabla de productos (decisión 10)

* `deleteProduct` falla si el producto aparece en algún `order_items`
  (FK `on delete restrict`). Capturar el error de FK y mostrar: "Este producto
  tiene ventas; desactívalo en lugar de eliminarlo".

### Cómo verificar al terminar

* `seller1` publica un producto con 3 imágenes, las reordena antes de enviar
  → `product_images.position` refleja el orden y la portada en el catálogo es
  la primera.
* En editar, arrastrar una miniatura persiste `position` sin recargar.
* Arrastrar `c…02` (pendiente) a "Pagado" → `orders.status = 'pagado'`;
  arrastrarlo directo a "Entregado" → rechazado con toast, sin llamada al service.
* Intentar soltar en "Cancelado" → no permitido.
* `seller2` no ve los productos de `seller1` en su tabla ni puede abrir su
  URL de edición.
* Eliminar un producto del seed con ventas → mensaje de "desactívalo".

## Fase 3.8 — Responsive, accesibilidad y estados

**Prompt sugerido:** "Ejecuta la Fase 3.8 de `MercadoTech_sesion3.md`."

### Qué se construye

No hay funcionalidad nueva: es una pasada de calidad por TODAS las pantallas
del mapa de rutas, cerrando lo que quedó a medias y verificando la separación
de capas.

### Depende de

3.1–3.7 completas.

### Checklist (una fila por pantalla, en `docs/SESION3_CHECKLIST.md`)

| Verificación | Criterio |
|---|---|
| Responsive | Se ve bien en 375 px, 768 px y 1280 px; sin scroll horizontal. |
| Carga | Toda lista/detalle muestra `Skeleton` mientras carga (no spinner genérico). |
| Vacío | Toda lista vacía muestra `EmptyState` con acción sugerida (ej. carrito vacío → "Explorar productos"). |
| Error | Todo fallo de service muestra `ErrorState` con `onRetry` funcional. |
| Teclado | Formularios navegables con Tab; ambos drag & drop operables con teclado (`KeyboardSensor` de dnd-kit + anuncios `aria`). |
| Imágenes | Todas vía `ProductImage`/`next/image` con `alt` significativo. |
| Tema | Claro y oscuro sin contrastes rotos. |

### Limpieza

* Borrar `app/dev/ui/page.tsx` (muestra de la Fase 3.1).
* Eliminar cualquier placeholder "Próximamente" que haya sobrevivido.

### Verificación de capas (ejecutar y pegar el resultado en el checklist)

```bash
grep -rl "@/lib/supabase" components hooks
```

Debe devolver vacío (solo `services/` y `app/` pueden importar clientes).

```bash
grep -rl "from \"@/services" components
```

Debe devolver vacío (los componentes no llaman services).

### Cómo verificar al terminar

* Checklist completo en verde.
* `npm run lint`, `npm run type-check` y `npm run build` pasan.
* Los dos greps devuelven vacío.

---

## Restricciones de la sesión

* NO tocar migraciones existentes, `seed.sql` ni políticas RLS. Única migración
  nueva prevista: `handle_new_user` con metadata (Fase 3.3). Cualquier otra debe
  justificarse en su comentario SQL.
* NO implementar IA, embeddings, chat, búsqueda semántica ni voz (sesiones 4 y 8).
* NO crear el panel admin (solo se usa el rol para moderación vía RLS).
* NO crear vista `public_profiles` ni trigger de reposición de stock (se
  documentan como limitaciones, no se resuelven aquí).
* Componentes NO hacen fetching; hooks NO contienen lógica de negocio (salvo
  las transiciones del kanban, asignadas explícitamente); services NO conocen React.
* Sin pasarela de pagos real. Sin realtime.
* NO crear Route Handlers en `app/api/v1/` en esta sesión.

## Entregables

1. `types/database.ts` generado + tipos de dominio; sistema visual + componentes base.
2. Navegación completa (shop / vendedor / auth) responsive, con el mapa de rutas de la Fase 3.2.
3. Auth funcional: registro con rol (migración nueva), login, logout, middleware de rutas protegidas, guard de rol.
4. Catálogo con filtros en URL, búsqueda por texto y paginación; detalle con Q&A, reseñas verificadas y favoritos.
5. Carrito persistente + checkout simulado transaccional + mis pedidos con cancelación.
6. Panel vendedor: CRUD de productos, galería drag & drop, kanban de pedidos drag & drop.
7. Hooks y services para cada dominio, con cliente Supabase inyectable.
8. `docs/SESION3_CHECKLIST.md` con la pasada de la Fase 3.8.
9. `docs/BITACORA.md` (bitácora acumulativa, sección de la sesión 3 completa) y `CLAUDE.md` actualizado con las convenciones y el estado del proyecto.

## Criterios de aceptación de la sesión

* Flujo comprador completo: registro → explorar → filtrar → detalle → preguntar
  → carrito → checkout → ver pedido → cancelar si pendiente.
* Flujo vendedor completo: registro como vendedor → publicar con imágenes
  reordenadas → producto visible en catálogo → recibir pedido → moverlo por el
  kanban → comprador ve el nuevo estado al recargar.
* Reseña solo posible tras pedido `entregado` (UI y RLS).
* Transiciones inválidas del kanban rechazadas en el hook sin llegar al service.
* `npm run lint`, `npm run type-check` y `npm run build` pasan.
* `grep -rl "@/lib/supabase" components hooks` devuelve vacío.

---

## Registro de cambios de esta versión de la spec (2026-08-21)

Validación del documento contra el repositorio (migraciones, RLS, seed y
scaffold de la sesión 2). Cambios respecto a la versión anterior:

* **Estructura:** cada fase ahora tiene las mismas secciones (Qué se construye /
  Depende de / Archivos / Reglas / Cómo verificar). Se añadieron "Estado de
  partida", "Mapa de fases", "Convenciones transversales" y el mapa de rutas.
* **Correcciones obligatorias** (sin ellas la spec original no se podía ejecutar):
  migración para registrar con rol `seller` (3.3); prefijo `/vendedor` y
  borrado de `app/page.tsx` para evitar rutas duplicadas (3.2); generación de
  `types/database.ts` (3.1); `storage.service` adelantado a 3.4; componentes
  del navbar puros en 3.2 y conectados en fases posteriores.
* **Páginas/archivos que faltaban:** `/favoritos`, `/buscar`, `ProductImage`
  con placeholder, `lib/constants/{catalog,product,orders}.ts`,
  `docs/SESION3_CHECKLIST.md`.
* **Restricciones del esquema hechas explícitas:** `numeric` como string;
  nombres de otros usuarios no legibles; vendedor no cancela y RLS no valida
  secuencia; `deleteProduct` con ventas falla; cancelar no repone stock;
  `product_views` solo con sesión; subida de imágenes exige producto creado;
  pedidos multi-vendedor.
* **Sin cambios de alcance funcional:** no se agregó ni quitó ninguna
  funcionalidad de negocio respecto a la versión anterior; solo se hizo
  ejecutable y verificable.
