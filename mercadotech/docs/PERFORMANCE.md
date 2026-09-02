# Performance y Core Web Vitals — MercadoTech (Fase 7.2)

Regla de esta fase: **ningún cambio sin su número de antes, ninguno sin su
número de después.** Una optimización que no mueve la aguja se revierte y
queda anotada como intentada — también es un dato. Este documento incluye una
optimización revertida por esa razón.

---

## Metodología

**Todo se mide contra el build de producción** (decisión 12 de la spec):

```bash
npm run build && npm run start
```

Medir sobre `next dev` da números falsos: hay HMR, el código no está
minificado y React corre en modo desarrollo. Un número que venga de ahí no
cuenta.

**Tres instrumentos, tres cosas distintas:**

| Instrumento | Qué responde | Ruido |
|---|---|---|
| Resumen de rutas de `npm run build` (First Load JS) | Cuánto JavaScript descarga el navegador antes de poder usar cada página | Ninguno: determinista |
| Lighthouse móvil (DevTools → Mobile) | Qué experimenta alguien con un celular normal: LCP, TBT, CLS | **Alto** en local (ver abajo) |
| Inspección del DOM y del HTML servido | Qué pide realmente el navegador (ancho de imagen, preloads) | Ninguno: determinista |

**Sin `@next/bundle-analyzer`** (decisión 3): la dieta del bundle se decide
con el resumen por ruta del build. Que `lib/ai/` no llegue al cliente lo
garantizan `server-only` y los greps de capas de `CLAUDE.md`.

### Advertencia sobre el ruido de la medición local

Las corridas de Lighthouse se hicieron en una máquina que a la vez ejecutaba
Docker, los 12 contenedores de Supabase local y el servidor de Next. El TBT
se movió **más de 1000 ms entre corridas sin ningún cambio de código** (home:
3,650 → 2,580 ms). Por eso **ninguna decisión de esta fase se tomó con
Lighthouse solo**: cada cambio se aceptó o revirtió contra una medición
determinista (bytes del bundle, ancho de imagen pedido, contenido del HTML).

### Dataset de la medición

El catálogo local se pobló con fotos reales antes de medir
(`npx tsx scripts/seed-images.ts`, 16 productos con imagen de Unsplash).

Antes de poblarlo solo existía **1 objeto** en Storage: las 32 rutas de imagen
del seed caían al placeholder y la home no descargaba ni un byte de imagen.
Medir así habría dado un LCP artificialmente bueno y habría hecho imposible
evaluar cualquier ajuste de imagen.

> El catálogo de **producción** nace vacío a propósito (decisión 6): estas
> métricas describen una tienda con productos, que es el estado que importa.

---

## ANTES

### First Load JS por ruta (`npm run build`, `.next` borrado antes)

| Ruta | Size | First Load JS |
|---|---|---|
| `/vendedor/publicar` | 164 B | **277 kB** |
| `/vendedor/productos/[id]/editar` | 164 B | **277 kB** |
| `/buscar` | 8.55 kB | 261 kB |
| `/producto/[id]` | 7.7 kB | 258 kB |
| `/` (home) | 1.51 kB | **254 kB** |
| `/categoria/[slug]` (catálogo) | 1.51 kB | **254 kB** |
| `/carrito` | 3.67 kB | 254 kB |
| `/pedidos/[id]` | 2.52 kB | 225 kB |
| `/vendedor/pedidos` | 7.4 kB | **217 kB** |
| `/vendedor/productos` | 6.79 kB | 210 kB |
| `/register` | 4.14 kB | 204 kB |
| `/login` | 3.72 kB | 203 kB |
| `/soporte` | 3.16 kB | 200 kB |
| `/favoritos` | 6.38 kB | 200 kB |
| `/pedidos` | 1.75 kB | 193 kB |
| `/asistente` | 653 B | **130 kB** |
| _Compartido por todas_ | — | 102 kB |

### Lighthouse móvil

| Página | Performance | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|
| `/` (home) | **48** | 0.8 s | 4.9 s | 3,650 ms | 0.084 |
| `/producto/[id]` | **70** | 0.9 s | 1.8 s | 3,280 ms | 0 |
| `/asistente` | **76** | 0.8 s | 2.8 s | 810 ms | 0 |

Insights reportados en home: *Improve image delivery (91 KiB)*, *LCP request
discovery*, *Render-blocking requests (150 ms)*, *Legacy JavaScript (11 KiB)*,
*Reduce unused JavaScript (41 KiB)*, 20 long tasks.

---

## Ranking de candidatos (antes de tocar nada)

Los tres candidatos a `dynamic import` que la spec identificó (decisión 4),
ordenados por el impacto que la tabla del ANTES permite esperar:

| # | Candidato | Ruta(s) | First Load JS | Impacto esperado |
|---|---|---|---|---|
| 1 | `SortableImageGallery` | `/vendedor/publicar`, `/vendedor/productos/[id]/editar` | 277 kB | **Alto** — arrastra `@dnd-kit/{core,sortable,utilities}` |
| 2 | `OrdersKanban` | `/vendedor/pedidos` | 217 kB | **Medio** — arrastra `@dnd-kit/core` |
| 3 | `ChatWindow` | `/asistente`, `/soporte` | 130 / 200 kB | **Nulo** |

### El que no se tocó, y por qué

**`ChatWindow` se quedó como está.** `/asistente` pesa 130 kB, apenas **28 kB
por encima** del bundle compartido (102 kB), y ese delta es la página entera.
`ChatWindow` no arrastra ninguna librería pesada: React, `Button` y tres
componentes propios de chat. Diferirlo ahorraría kilobytes de un dígito a
cambio de un estado de carga en el elemento principal de la pantalla.

### Advertencia declarada ANTES de optimizar

El objetivo de la fase es **Lighthouse ≥ 90 en home y catálogo**, pero
**ninguno de los tres candidatos se renderiza en esas rutas**: viven en el
panel del vendedor y en el asistente. Se dijo de entrada que los `dynamic
import` mejorarían el bundle del vendedor **sin mover la nota de la home**.
Así fue.

---

## Optimizaciones aplicadas

### 1. `dynamic import` de `SortableImageGallery` — ACEPTADA

Commit `6ca1721`.

| Ruta | ANTES | DESPUÉS | Δ |
|---|---|---|---|
| `/vendedor/publicar` | 277 kB | **256 kB** | **−21 kB** |
| `/vendedor/productos/[id]/editar` | 277 kB | **256 kB** | **−21 kB** |

`@dnd-kit/{core,sortable,utilities}` sale del bundle inicial del formulario.

### 2. `dynamic import` de `OrdersKanban` — ACEPTADA

Commit `874e763`.

| Ruta | ANTES | DESPUÉS | Δ |
|---|---|---|---|
| `/vendedor/pedidos` | 217 kB | **204 kB** | **−13 kB** |

### 3. Quitar `ssr: false` de ambos `dynamic import` — CORRECCIÓN

Commit `e031acd`. Los dos `dynamic import` se escribieron primero con
`ssr: false`. Al medir:

| | First Load JS con `ssr:false` | sin `ssr:false` |
|---|---|---|
| `/vendedor/pedidos` | 204 kB | **204 kB** |
| `/vendedor/publicar` | 256 kB | **256 kB** |

**Idéntico.** `ssr: false` no aportaba nada al bundle y sí costaba: el
componente dejaba de renderizarse en servidor y había que esperar el chunk
antes de poder usar la pantalla.

**Lo cazó la suite E2E**, exactamente para lo que está: `seller-flow` se pasó
de su presupuesto de 30 s en la suite paralela (corriendo solo pasaba, en
19 s). El screenshot del fallo descartó "hidratación rota" — el kanban
renderizaba perfecto — y el cronómetro por paso señaló la espera del chunk.
Sin `ssr: false`: **8/8 verde**, `seller-flow` en 28.2 s. No se tocó ni una
línea del test.

### 4. `sizes` del grid + `priority` en la portada — **REVERTIDA (intentada, sin efecto)**

Commit `64dd809`, revertido en `2fbbb98`.

**Qué se intentó:** corregir el `sizes` para que espejara los breakpoints
reales del grid (2 → sm:3 → lg:4 columnas) y marcar `priority` en las dos
primeras cards, apuntando al insight *LCP request discovery* de Lighthouse.

**Por qué se revirtió — dos mediciones deterministas:**

1. **El `sizes` pide exactamente el mismo ancho, en todos los viewports
   probados.** Medido en el navegador con el mismo `<img>` del grid:

   | Viewport | `sizes` viejo pide | `sizes` nuevo pide |
   |---|---|---|
   | 375 px (móvil, el de Lighthouse) | **384 px** | **384 px** |
   | 820 px (tablet, 3 columnas) | **384 px** | **384 px** |

   Por debajo de 640 px ambos resuelven a `50vw`; el viejo solo difería entre
   768 y 1024 px, y en la práctica Next elegía el mismo escalón de ancho. Cero
   bytes de diferencia.

2. **`priority` no puede ayudar aquí: no hay nada que precargar al primer
   byte.** El HTML servido no contiene NI UNA imagen de producto:

   ```
   curl -s http://localhost:3000/ | grep -c '_next/image'          -> 0
   curl -s http://localhost:3000/ | grep -c 'rel="preload".*image' -> 0
   ```

   El catálogo entero se renderiza en cliente (`CatalogView` pide los
   productos con un hook tras hidratar). Los `<link rel="preload">` que
   `priority` genera se inyectan **después** de la hidratación, cuando ya no
   sirven para descubrir el LCP antes.

**Conclusión:** la optimización no tenía cómo funcionar en esta arquitectura.
Queda anotada, no aplicada.

---

## DESPUÉS

### First Load JS por ruta

| Ruta | ANTES | DESPUÉS | Δ |
|---|---|---|---|
| `/vendedor/publicar` | 277 kB | **256 kB** | **−21 kB** |
| `/vendedor/productos/[id]/editar` | 277 kB | **256 kB** | **−21 kB** |
| `/vendedor/pedidos` | 217 kB | **204 kB** | **−13 kB** |
| `/` (home) | 254 kB | 254 kB | — |
| `/categoria/[slug]` | 254 kB | 254 kB | — |
| `/producto/[id]` | 258 kB | 258 kB | — |
| _Compartido_ | 102 kB | 102 kB | — |

### Lighthouse móvil (con la optimización de imágenes aún aplicada)

Estos números se tomaron **antes** de revertir el cambio 4. Se conservan
porque son la evidencia que motivó el revert:

| Página | Performance | LCP | TBT | CLS |
|---|---|---|---|---|
| `/` (home) | 48 → **46** | 4.9 → **6.2 s** | 3,650 → 2,580 ms | 0.084 → 0.083 |
| `/producto/[id]` | 70 → **53** | 1.8 → **5.2 s** | 3,280 → 1,360 ms | 0 → 0.083 |

Los insights *Improve image delivery (91 KiB)* y *LCP request discovery*
**seguían presentes**, confirmando que el cambio no los tocó. El TBT bajó
~1,000 ms en ambas páginas sin que ningún cambio pudiera explicarlo: es el
ruido de la máquina, no mérito del código.

---

## Objetivos: qué se cumplió y qué no

| Objetivo | Estado | Evidencia |
|---|---|---|
| Bundle de las rutas más pesadas | ✅ | −21 kB y −13 kB, deterministas y reproducibles |
| Suites verdes tras cada cambio | ✅ | 292/292 unitarios · 8/8 E2E · lint · type-check · build |
| LCP < 2.5 s en home | ❌ | 4.9–6.2 s |
| CLS < 0.1 | ✅ | 0.083–0.084 |
| INP < 200 ms | n/d | Lighthouse no lo reporta sin interacción (usa TBT) |
| **Lighthouse ≥ 90 en home y catálogo** | ❌ | **48 / 46** |

### Por qué no se alcanzó el ≥ 90, sin rodeos

**1. El TBT es el techo, y ninguna optimización autorizada lo toca.**
Lighthouse pesa el TBT al 30 %. Con 2,580–3,650 ms ese 30 % puntúa
prácticamente cero: aunque el LCP fuera perfecto, la home no pasaría de ~60.
Los tres candidatos autorizados viven en rutas que la auditoría ni visita.

**2. El catálogo se renderiza en el cliente, y ahí nace el LCP malo.**
El HTML del servidor llega **sin productos**. La cadena hasta ver la primera
foto es: descargar JS → hidratar → pedir productos a Supabase → pedir la
imagen. Ningún ajuste de `sizes` o `priority` acorta esa cadena; hay que
cortarla de raíz.

**3. Parte del número es la máquina.** Docker + 12 contenedores de Supabase +
el servidor de Next + Chrome compitiendo por la misma CPU. La medición que
cuenta para el criterio de aceptación es la de la **URL de Vercel** (Fase
7.4), donde el servidor no compite con la base de datos.

### Recomendación para la próxima iteración (fuera del alcance de esta fase)

Lo que de verdad movería la aguja en home y catálogo es **renderizar la
primera página de productos en el servidor** (Server Component que consulte
el catálogo y entregue el HTML con las cards ya puestas). Eso ataca las tres
causas a la vez: elimina el round-trip post-hidratación del LCP, permite que
`priority`/preload sirvan de algo, y baja el trabajo de JS en el hilo
principal. Es un cambio de arquitectura, no una optimización puntual: excede
lo que esta fase autoriza (decisión 4 fija los candidatos) y merece su propia
iteración con su propia medición.
