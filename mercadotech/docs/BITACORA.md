# Bitácora del proyecto MercadoTech

Registro acumulativo, sesión más reciente primero. Cada entrada documenta qué
se construyó, qué se decidió y por qué, qué problemas aparecieron y qué quedó
fuera a propósito.

> **Nota sobre el historial de git.** Los 18 commits del repositorio se
> crearon **todos el 2026-08-31**, al cierre de la sesión 3: hasta ese
> momento el trabajo vivía sin versionar en el working tree. Por eso las
> fechas de los commits **no reflejan** cuándo se hizo cada fase, y los
> archivos que se tocaron en varias fases quedaron en un solo commit (su
> estado final). Los hashes son reales y agrupan el trabajo por fase; la
> cronología no es un replay fiel.
>
> Dos commits no corresponden a una sola fase: `cff5913` reúne **todas** las
> páginas de `app/` y los conectores hook↔componente (se reescribieron a lo
> largo de las fases 3.2–3.7, así que solo existe su estado final), y
> `a6494fa` es el `CLAUDE.md` de la sesión 2, que se había quedado sin
> versionar.

---

## Sesión 3 — UI inteligente y frontend multimodal (2026-08-30 / 2026-08-31)

**Alcance:** MVP funcional completo del marketplace sobre la infraestructura
de la sesión 2. 129 archivos, +8829 líneas (`git diff --stat cece039..HEAD`).

### Prompt 0 — Provisión del entorno (commit `31385d3`)

**Construido:** stack Supabase local levantado, `.env.local` generado desde
`supabase status -o env`, dependencias (`lucide-react`, `@dnd-kit/*`), los 16
componentes de `components/ui/` (shadcn) y los scripts `db:types` y
`type-check` en `package.json`.

**Decisión:** se agregó `type-check` además de `db:types`, porque las fases
siguientes lo exigen y no existía — sin él, `npm run type-check` fallaba por
script inexistente, no por errores de tipos.

**Problema:** `npm install -g supabase` falló con `ENOENT` en
`C:\Users\MK\AppData\Roaming\npm` (el directorio de prefijo global de npm no
existía). Se creó y la instalación funcionó.

**Fuera de alcance:** `docs/COSTOS.md` y `docs/PROMPTS.md` (sesión 1, nunca
ejecutada).

### Fase 3.1 — Tipos, sistema visual y componentes base (commit `5bc9033`)

**Construido:** `types/database.ts` generado con `npm run db:types`, tipos de
dominio (`product.ts`, `order.ts`, `user.ts`, `question.ts`, `review.ts`),
tokens de tema con primario azul eléctrico en `app/globals.css`,
`formatPrice` en `lib/utils.ts`, `images.remotePatterns` en `next.config.ts`,
y los 8 componentes de `components/shared/`.

**Decisión:** se agregaron tokens semánticos propios (`--success`,
`--warning`, `--info`) además de los de shadcn, para que `ConditionBadge` y
`OrderStatusBadge` no hardcodeen colores.

**Problema:** este `components.json` usa el estilo `base-nova` de shadcn,
montado sobre `@base-ui/react` y **no sobre Radix**. Los triggers no aceptan
`asChild` sino `render={<Button />}`. Se detectó con `tsc` y se corrigió en
las 3 instancias de `/dev/ui`.

**Fuera de alcance:** componentes de dominio (llegan en cada fase).

### Fase 3.2 — Layouts, navegación y mapa de rutas (commit `e5cd363`)

**Construido:** layout raíz real (`lang="es"`, metadata, `<Toaster />`), los
3 layouts de grupo, los 8 componentes de `components/layout/` (puros) y las
14 rutas del mapa como placeholders.

**Decisión:** el panel del vendedor vive bajo `/vendedor/...` para que
`/pedidos` (comprador) y `/vendedor/pedidos` no colisionen; se eliminó
`app/page.tsx` porque chocaba con `app/(shop)/page.tsx` (ambas resuelven `/`).

**Problema 1:** el build falló con *"Event handlers cannot be passed to
Client Component props"* — el layout (Server Component) pasaba `onSearch={()
=> {}}` a `SearchBar` (cliente). Se resolvió haciendo `onSearch` opcional con
el no-op **dentro** del componente cliente.

**Problema 2:** base-ui avisaba que `Button render={<Link/>}` rompe la
semántica nativa de botón. Se cambió al patrón estándar de shadcn:
`<Link className={buttonVariants({...})}>`.

**Fuera de alcance:** conectar los componentes del navbar a datos reales
(cada fase posterior conecta el suyo); ruta `/soporte` (sesión 4).

### Fase 3.3 — Autenticación (commit `e3015e9`)

**Construido:** migración `20260831100000_handle_new_user_metadata.sql`,
`lib/validators/auth.ts`, `services/auth.service.ts`, `hooks/useAuth.ts`,
`components/auth/`, pantallas `/login` y `/register`, y el middleware
ampliado con protección de rutas.

**Decisión:** el rol se fija en el INSERT del trigger de alta leyendo
`raw_user_meta_data`, porque `protect_profile_role` (Fase 2.3) es
`BEFORE UPDATE` e impide cambiarlo después. Es el **único** momento del ciclo
de vida en que puede establecerse. La allow-list acepta solo `buyer`/`seller`:
cualquier otro valor (incluido `admin` manipulado desde DevTools) cae a
`buyer`.

**Decisión 2:** los layouts son Server Components y no pueden usar hooks, y
la regla de capas prohíbe que `components/` importe `hooks/`. Se crearon
conectores **colocados en `app/`** (`ShopNavbar.tsx`, `SellerGuard.tsx`), un
patrón que se repite en todas las fases siguientes.

**Problema:** el middleware protegía correctamente, pero faltaba cubrir el
caso "hay sesión pero el rol no alcanza" — lo cubre `SellerGuard`, que
además muestra `LoadingState` mientras `initializing` es true para no
parpadear.

**Fuera de alcance:** confirmación de email (en local
`enable_confirmations = false`), recuperación de contraseña.

### Fase 3.4 — Catálogo (commit `8517742`)

**Construido:** `lib/constants/catalog.ts`, `storage.service.ts` (solo
`getPublicUrl`), `category.service.ts`, `product.service.ts`,
`useCategories`, `useProducts`, los 4 componentes de `components/catalog/`, y
las 3 páginas del catálogo compartiendo el mismo grid y hook vía
`CatalogView`.

**Decisión:** los filtros viven en la URL (`useSearchParams`) como única
fuente de verdad, así el estado es compartible y recargable. Cambiar un
filtro vuelve a página 1.

**Decisión 2:** `is_active = true` se filtra **explícitamente** aunque la RLS
ya lo garantiza para anónimos — sin ese filtro, un vendedor logueado vería
sus propios productos inactivos en la home.

**Problema:** el filtro `.or()` de PostgREST separa condiciones por comas, así
que un término de búsqueda con coma o paréntesis rompía el parseo. Se
sanitizan antes de interpolar.

**Fuera de alcance:** búsqueda semántica (sesión 4); la búsqueda por texto es
`ilike` sobre `title` y `brand`, marcada como provisional en el código.

### Fase 3.5 — Detalle, Q&A, reseñas y favoritos (commit `45b8394`)

**Construido:** `registerView` en `product.service`, los services
`question`/`review`/`favorite`, 5 hooks, los 5 componentes de
`components/product/`, y las páginas `/producto/[id]` y `/favoritos`.

**Decisión:** la UI solo ofrece acciones que la RLS va a permitir
("defensa en profundidad"): `canReview` replica exactamente la condición de
`reviews_insert_verified_purchase` (pedido propio `entregado` con ese
producto, y sin reseña previa), y el input de respuesta solo aparece si
`profile.id === product.seller_id`.

**Desviación de la spec:** la spec cita un trigger
`lock_question_immutable_fields` que **no existe** en el repo (verificado con
grep). Lo que restringe es la política `questions_update_seller_answers`, que
limita *quién* actualiza pero no *qué columnas*. El service se disciplina
enviando solo `{answer, answered_at}`.

**Fuera de alcance:** vista `public_profiles` — por eso las preguntas
muestran "Usuario" y las reseñas "Comprador verificado".

### Fase 3.6 — Carrito, checkout y pedidos (commit `6b070dc`)

**Construido:** `lib/constants/orders.ts`, `cart.service.ts`,
`order.service.ts`, `useCart`, `useOrders`, `components/cart/`,
`components/orders/`, y las páginas `/carrito`, `/pedidos`, `/pedidos/[id]`.

**Decisión:** `useCart` usa un store a nivel de módulo con
`useSyncExternalStore`. Se monta simultáneamente en tres lugares (navbar,
detalle de producto y `/carrito`); con `useState` local, el contador del
navbar quedaba desactualizado al agregar desde el detalle.

**Decisión 2:** el checkout llama **siempre** al RPC
`create_order_from_cart`, nunca a un insert directo: `orders` no tiene
política ni GRANT de INSERT, así que un insert del cliente falla con
"permission denied".

**Problema:** ninguno funcional. Se verificó el rollback del RPC con stock
insuficiente: el toast mostró el mensaje exacto de Postgres nombrando el
producto, el carrito quedó intacto y no se creó ningún pedido.

**Desviación de la spec:** el trigger `lock_order_immutable_fields` que cita
la spec **no existe**; quien restringe la cancelación es la política
`orders_update_buyer_cancel_pending`. Además, el producto con stock 0 es
`b…05`, no `b…06`.

**Fuera de alcance:** pasarela de pago real (el checkout es simulado y la UI
lo dice), reposición de stock al cancelar, realtime.

### Fase 3.7 — Panel del vendedor con drag & drop (commit `c845e5a`)

**Construido:** `lib/constants/product.ts`, `lib/validators/product.ts`,
`seller.service.ts`, `storage.service` ampliado (upload/delete/saveImageOrder/
addProductImage), 3 hooks y los 5 componentes de `components/seller/` con los
dos drag & drop.

**Decisión (galería):** en modo **create** las imágenes viven solo en memoria
(`File[]` + `createObjectURL`) porque el path de Storage exige `product_id`,
que aún no existe; al enviar se crea el producto, se suben en el orden final
y se insertan con `position = índice`. En modo **edit** cada acción persiste
al instante.

**Decisión (kanban):** la RLS permite poner `pagado`/`enviado`/`entregado`
pero **no valida la secuencia** (aceptaría `entregado → pagado`). El hook
rechaza toda transición que no sea un paso adelante en `ORDER_STATUS_FLOW`,
sin llamar al service. `cancelado` queda bloqueado por doble barrera: el hook
(no está en el FLOW) y la RLS (`42501`).

**Desviación importante de la spec (decisión 10):** la spec asume que
`order_items.product_id` es `ON DELETE RESTRICT` y que basta con capturar el
error `23503`. En el esquema **real** es `ON DELETE SET NULL`
(`confdeltype='n'`, verificado en la BD), así que ese catch sería **código
muerto**: el borrado tendría éxito y arrastraría en cascada
`product_images`, `questions`, `reviews`, `favorites` y `product_views`. Se
implementó un **guard a nivel de aplicación** que consulta `order_items`
antes de borrar; el catch de `23503` quedó como respaldo por si la FK se
endurece.

**Corrección de capas propia:** el tipo `SellerOrder` vivía en `services/` y
lo importaban los componentes; se movió a `types/order.ts`.

**Fuera de alcance:** cancelar desde el panel del vendedor (la RLS no lo
permite: la columna "Cancelado" es de solo lectura).

### Fase 3.8 — Responsive, accesibilidad y estados (commit `eb98892`)

**Construido:** `docs/SESION3_CHECKLIST.md`, `app/ThemeProvider.tsx`, y las
correcciones de la pasada de calidad. Se borró `app/dev/ui/page.tsx`.

**Problemas encontrados y corregidos:**

| Hallazgo | Corrección |
|---|---|
| `useAuth` importaba el cliente de Supabase (violación de capas; el grep de la spec lo detectaba) | Se movió `onAuthStateChange` a `auth.service.ts` |
| `useProductForm` cargaba sin `.catch()`: un fallo de red dejaba una promesa rechazada y el formulario en blanco | `loadError` + `retry` + `ErrorState` |
| **El tema oscuro era inalcanzable**: los tokens `.dark` existían pero nada añadía esa clase; con el SO en oscuro la app salía en claro | Se conectó `next-themes` (ya instalado); de paso arregla el `<Toaster />`, que llamaba a `useTheme()` sin provider |
| 4 `EmptyState` sin acción sugerida | "Limpiar filtros", "Ver catálogo", "Ver mis pedidos", "Publicar producto" |
| Los anuncios aria de la galería decían el **uuid** de la imagen | Ahora dicen la posición ("Imagen 2 de 3") |
| El kanban movía por píxeles con las flechas y no caía en una columna | `coordinateGetter` propio que salta de columna |
| El radio de rol de `RegisterForm` es `sr-only`: el foco de teclado era **invisible** | Foco proyectado sobre la tarjeta con `has-[:focus-visible]` |

**Fuera de alcance:** ninguna funcionalidad nueva (era una pasada de calidad).

---

### (a) Criterios de aceptación de la sesión

| Criterio | Estado | Evidencia |
|---|---|---|
| Flujo comprador completo | ✅ | Verificado por fases: registro con rol, login del seed, filtros en URL, detalle, carrito, checkout (stock 30→28, carrito vacío), pedido, cancelación |
| Flujo vendedor completo | ✅ | Publicar con imágenes (paths `{seller_id}/{product_id}/{n}.png`, `position` 0/1/2), producto en catálogo, kanban con transición válida persistida vía RLS |
| Reseña solo tras pedido `entregado` | ✅ | `buyer1` en `b…06` no ve el formulario (ya reseñó); tras marcar `c…03` entregado, `buyer2` sí lo ve en `b…11` y la reseña quedó con `order_id` correcto |
| Transiciones inválidas rechazadas en el hook | ✅ | Toast + **0 llamadas PATCH** a la red (se instrumentó `fetch`) |
| `lint`, `type-check` y `build` pasan | ✅ | Los tres en exit 0; build con 15 rutas |
| `grep -rl "@/lib/supabase" components hooks` vacío | ✅ | Vacío tras mover `onAuthStateChange` al service |

### (b) Deuda técnica y limitaciones vigentes

1. **Nombres de otros usuarios no legibles.** `profiles_select_own_or_admin`
   solo deja ver el profile propio, así que preguntas muestran "Usuario" y
   reseñas "Comprador verificado". Requeriría una vista `public_profiles`.
2. **Cancelar un pedido NO repone stock.** No hay trigger que lo haga. La UI
   lo advierte en el diálogo de confirmación.
3. **Pedidos multi-vendedor comparten `orders.status`.** Cada vendedor ve
   solo sus ítems y su `myTotal`, pero mover la tarjeta cambia el estado del
   pedido **completo**, incluido lo del otro vendedor.
4. **Sin realtime.** El comprador ve los cambios de estado al recargar.
5. **Imágenes del seed inexistentes en Storage.** Los `image_path` del seed
   apuntan a archivos que nadie subió; `ProductImage` muestra placeholder.
6. **`order_items.product_id` es `SET NULL`, no `RESTRICT`.** El borrado de
   productos con ventas se bloquea solo por el guard de aplicación en
   `seller.service.deleteProduct`. Si alguien borra por SQL directo, se
   pierden reseñas y preguntas en cascada. Endurecer la FK requeriría
   migración.
7. **Arrastre con puntero no verificado de punta a punta.** El panel del
   navegador corre oculto y los rects quedan degenerados
   (`clientWidth: 0`), así que dnd-kit no resuelve destino de drop. La lógica
   subyacente sí está verificada; falta una prueba manual con mouse.
8. **El historial de git no replica la cronología real** (ver nota inicial).

### (c) Pendientes

**Heredados de sesiones anteriores:**

- **Sesión 1 completa:** no se ejecutó. Faltan `docs/COSTOS.md` y
  `docs/PROMPTS.md` (estrategia de modelos/costos, biblioteca de prompts,
  test A/B). No bloquea nada del código.
- **Fase 2.6:** `supabase/tests/` sigue **vacío** (solo `.gitkeep`). Faltan
  los scripts de validación RLS con los 9 escenarios de la spec.
- **Fase 2.7:** ✅ **ya no está pendiente** — `docs/ARQUITECTURA.md` existe
  (commit `cece039`).

**Para la sesión 4:**

- pgvector + embeddings de `support_articles` (los 10 artículos del seed ya
  tienen contenido real, pensados como base del RAG).
- Búsqueda semántica: reemplaza el `ilike` provisional de
  `product.service.listActiveProducts`.
- Asistente de compras y soporte por texto; ruta `/soporte` (todavía no
  existe y por eso no está en el menú).
- Variables de entorno de IA en `.env.example` (hoy solo tiene las de
  Supabase, con nota de que las de IA llegan en la sesión 4).

---

## Sesión 2 — Arquitectura y backend con Supabase

> *Sección reconstruida a partir de los commits del repositorio.*

| Fase | Commit | Qué dejó |
|---|---|---|
| 2.1 | `3e04644` | Proyecto Next.js 15 + TypeScript estricto + Tailwind v4, shadcn inicializado, los 4 clientes de `lib/supabase/`, `.env.example`, `lib/constants/roles.ts` |
| 2.2 | `a695bf7` | 17 migraciones: extensiones, 14 tablas con RLS habilitado, trigger `handle_new_user`, RPC transaccional `create_order_from_cart`, 14 índices; `schema.sql` de referencia |
| 2.3 | `26016dd` | Políticas RLS de las 14 tablas + GRANTs de la Data API, helper `is_admin()`, trigger `protect_profile_role`; `policies.sql` de referencia |
| 2.4 | `b042a5f` | Buckets `product-images` y `avatars` (públicos de lectura, 5 MB, jpeg/png/webp) con políticas por carpeta de propietario |
| 2.5 | `aaa792c` | `seed.sql`: 6 usuarios, 8 categorías, 16 productos, 32 imágenes, 7 pedidos en los 5 estados, 8 preguntas, 4 reseñas, 10 artículos de FAQ |
| 2.6 | — | **No ejecutada.** `supabase/tests/` vacío |
| 2.7 | `cece039` | `docs/ARQUITECTURA.md` |

Hallazgos técnicos de esa sesión que siguen vigentes en el código: el
`REVOKE` previo a los GRANT en `public` (Supabase concede `ALL` por defecto
vía `ALTER DEFAULT PRIVILEGES`), el uso de `SECURITY DEFINER` en `is_admin()`
y `order_has_own_item()` para romper recursión de RLS, y que ese mismo
`REVOKE` **no funciona** en el schema `storage` (las tablas son de
`supabase_storage_admin`, no de `postgres`).

---

## Sesión 1 — Fundamentos, setup y estrategia de costos

> *Sección reconstruida: **no hay commits** de esta sesión.*

**No se ejecutó.** El repositorio se inicializó al comienzo de la sesión 2.
No existen `docs/COSTOS.md` ni `docs/PROMPTS.md`, ni el test A/B de modelos.
Ninguna fase posterior depende de estos entregables.
