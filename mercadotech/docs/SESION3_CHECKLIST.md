# Checklist de la Fase 3.8 — responsive, accesibilidad y estados

Pasada de calidad sobre las 14 rutas del mapa (Fase 3.2). No hay
funcionalidad nueva: solo estados de carga/vacío/error, responsive,
accesibilidad y limpieza.

**Verificado contra**: Supabase local con el seed de la Fase 2.5, servidor de
desarrollo real, y navegador con viewport emulado a 375 / 768 / 1280 px y
`prefers-color-scheme` en claro y oscuro.

---

## Verificación de capas

Ambos greps deben devolver vacío. Salida real tras las correcciones:

```bash
$ grep -rl "@/lib/supabase" components hooks
# (vacío)

$ grep -rl "from \"@/services" components
# (vacío)
```

Los dos daban resultado antes de esta fase; ver "Correcciones aplicadas".

---

## Rutas (14 del mapa)

Códigos verificados con `curl` contra el servidor de desarrollo, sin sesión.

| # | Ruta | Acceso | Respuesta anónimo | Skeleton | Vacío + acción | Error + reintento | Teclado | Imágenes | Tema |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `/` | público | 200 | ✅ grid de skeletons | ✅ "Limpiar filtros" | ✅ `ErrorState` + retry | ✅ | ✅ `ProductImage` | ✅ |
| 2 | `/buscar?q=` | público | 200 | ✅ | ✅ "Limpiar filtros" | ✅ | ✅ | ✅ | ✅ |
| 3 | `/categoria/[slug]` | público | 200 | ✅ | ✅ "Limpiar filtros" | ✅ | ✅ | ✅ | ✅ |
| 4 | `/producto/[id]` | público | 200 | ✅ `LoadingState` | ✅ "Ver catálogo" | ✅ | ✅ galería ←/→ | ✅ + placeholder | ✅ |
| 5 | `/favoritos` | sesión | 307 → `/login?redirectTo=` | ✅ grid | ✅ "Explorar productos" | ✅ | ✅ | ✅ | ✅ |
| 6 | `/carrito` | sesión | 307 → `/login?redirectTo=` | ✅ | ✅ "Explorar productos" | ✅ | ✅ | ✅ | ✅ |
| 7 | `/pedidos` | sesión | 307 → `/login?redirectTo=` | ✅ | ✅ "Explorar productos" | ✅ | ✅ | — | ✅ |
| 8 | `/pedidos/[id]` | sesión | 307 → `/login?redirectTo=` | ✅ | ✅ "Ver mis pedidos" | ✅ | ✅ diálogo | — | ✅ |
| 9 | `/vendedor/productos` | seller | 307 → `/login?redirectTo=` | ✅ | ✅ "Publicar producto" | ✅ | ✅ | ✅ | ✅ |
| 10 | `/vendedor/publicar` | seller | 307 → `/login?redirectTo=` | ✅ | — (formulario) | ✅ | ✅ galería | ✅ | ✅ |
| 11 | `/vendedor/productos/[id]/editar` | seller | 307 → `/login?redirectTo=` | ✅ | ✅ "Ver mis productos" | ✅ | ✅ galería | ✅ | ✅ |
| 12 | `/vendedor/pedidos` | seller | 307 → `/login?redirectTo=` | ✅ | ✅ "Publicar producto" | ✅ | ✅ kanban ←/→ | — | ✅ |
| 13 | `/login` | público | 200 | — | — | ✅ error en línea | ✅ | — | ✅ |
| 14 | `/register` | público | 200 | — | — | ✅ error en línea | ✅ foco visible | — | ✅ |

`/dev/ui` (muestra de la Fase 3.1): **borrada** → devuelve 404.
Placeholders "Próximamente": **0** (grep sin resultados).

---

## Responsive (sin scroll horizontal)

Medido con `document.documentElement.scrollWidth > clientWidth` en el
navegador, con viewport emulado.

| Pantalla | 375 px | 768 px | 1280 px |
|---|---|---|---|
| `/` (grid + filtros) | ✅ sin overflow | ✅ | ✅ |
| `/producto/[id]` | ✅ sin overflow | ✅ | ✅ |
| `/carrito` (con ítem real) | ✅ sin overflow | ✅ sin overflow | ✅ |
| `/pedidos` | ✅ | ✅ sin overflow | ✅ |
| `/vendedor/pedidos` (kanban, 5 columnas) | ✅ | ✅ sin overflow | ✅ |
| `/vendedor/productos` (tabla) | ✅ | ✅ | ✅ sin overflow de página; la tabla scrollea dentro de `overflow-x-auto` |
| `/login` | ✅ sin overflow | ✅ | ✅ |

Comprobaciones estructurales de apoyo:

- Anchos fijos grandes (`w-[NNNpx]`, `min-w-[NNNpx]`): **ninguno**.
- Las 2 tablas (`OrderItemsTable`, `ProductsTable`) van envueltas en
  `overflow-x-auto`, así que scrollean ellas y no la página.
- `CartItemRow` es el layout más ajustado (sin breakpoints): funciona a
  375 px gracias a `min-w-0` en el bloque de texto y `shrink-0` en los
  controles. Verificado con un ítem real en el carrito.

---

## Accesibilidad

| Verificación | Estado | Detalle |
|---|---|---|
| Formularios navegables con Tab | ✅ | Inputs/Select/Textarea de shadcn traen `focus-visible:ring` propio |
| Foco visible en controles propios | ✅ | Corregido: flechas y miniaturas de `ProductGallery`, botones de `SortableImageGallery`, y el selector de rol de `RegisterForm` (ver correcciones) |
| Campos con etiqueta asociada | ✅ | `htmlFor`/`aria-label` en los 3 formularios |
| Errores anunciados | ✅ | 14 usos de `aria-invalid` + `aria-describedby` en los mensajes |
| Drag & drop #1 (galería) por teclado | ✅ | `KeyboardSensor` + `sortableKeyboardCoordinates`; asa dedicada con `aria-label` por posición |
| Drag & drop #2 (kanban) por teclado | ✅ | `KeyboardSensor` con `coordinateGetter` propio que salta de columna con ←/→ (corregido) |
| Anuncios `aria` en ambos drag & drop | ✅ | Por posición ("Imagen 2 de 3") y por columna ("Pedido a1b2c3d4, Pendiente"), no por uuid |
| Imágenes con `alt` significativo | ✅ | Todas vía `ProductImage`; cero `<img>` crudas. Los `alt=""` son decorativos y su botón contenedor lleva el nombre |
| Contraste claro/oscuro | ✅ | Cero colores hardcodeados en código propio: todo sobre tokens de `globals.css` |

---

## Tema claro / oscuro

Verificado emulando `prefers-color-scheme` y leyendo los estilos computados:

| Preferencia del sistema | Clase en `<html>` | Fondo del `body` | `--primary` |
|---|---|---|---|
| oscuro | `dark` ✅ | `oklch(0.145 0 0)` | `oklch(0.623 0.214 259.815)` |
| claro | (sin clase) ✅ | `oklch(1 0 0)` | `oklch(0.546 0.245 262.881)` |

---

## Criterios de aceptación de la sesión

| Criterio | Estado |
|---|---|
| Flujo comprador completo | ✅ registro → explorar → filtrar → detalle → preguntar → carrito → checkout → ver pedido → cancelar si pendiente |
| Flujo vendedor completo | ✅ registro como vendedor → publicar con imágenes → visible en catálogo → recibir pedido → mover por el kanban → el comprador ve el nuevo estado al recargar |
| Reseña solo tras pedido `entregado` | ✅ UI (`canReview`) y RLS (`reviews_insert_verified_purchase`) |
| Transiciones inválidas del kanban rechazadas en el hook | ✅ sin llegar al service (verificado con 0 llamadas de red) |
| `npm run lint`, `type-check` y `build` | ✅ los tres en verde |
| `grep -rl "@/lib/supabase" components hooks` vacío | ✅ |

---

## Correcciones aplicadas en esta fase

Ver la lista detallada en el resumen de la fase. En síntesis: 1 violación de
capas, 1 promesa sin `catch`, 1 tema oscuro inalcanzable, 4 `EmptyState` sin
acción, 3 problemas de foco/anuncios de accesibilidad.

## Limitación de verificación conocida

El **arrastre con puntero** de ambos drag & drop no pudo ejercitarse de punta
a punta en este entorno: el panel del navegador corre oculto y los rects de
layout quedan degenerados, así que la detección de colisiones de dnd-kit no
resuelve un destino. La lógica subyacente sí está verificada (reglas de
transición en aislamiento, persistencia del reorden vía `saveImageOrder`, y
0 llamadas al service ante una transición inválida). El arrastre con mouse
queda pendiente de una prueba manual.
