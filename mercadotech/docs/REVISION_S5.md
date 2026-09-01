# Revisión de sesión 5 — servidor MCP, `lib/ai/`, `services/` y `hooks/`

Consolidado de las revisiones hechas con `mercadotech-tech-lead` (sobre
`mcp/src/` completo y sobre `services/`+`hooks/` completos) y
`mercadotech-code-reviewer` (sobre `lib/ai/`, los 3 Route Handlers de
`app/api/v1/` y `mcp/src/`), más el hallazgo en vivo al probar
`ask_assistant` con laptops. Una fila por hallazgo.

| Hallazgo | Severidad | Veredicto | Evidencia |
|---|---|---|---|
| URIs sintéticas (`mercadotech://compare`, `mercadotech://questions/{id}`) sin resource real detrás, en los prompts `comparar_productos` y `redactar_respuesta_pregunta` | Baja | Corregido | Commit `3947a4c` — `mcp/src/prompts/compare-products.ts`, `mcp/src/prompts/draft-question-answer.ts` |
| El log de error de `/api/v1/chat` incluía el texto completo de la consulta, inconsistente con el log de éxito de la misma ruta que ya lo omite | Baja | Corregido | Commit `20c12f7` — `app/api/v1/chat/route.ts` |
| `useCart`: el store módulo-global no limpia `items` de forma síncrona al cambiar `userId` — entre el logout de un usuario y que resuelva el `loadItems` del siguiente, un componente montado (p. ej. el contador del navbar) puede mostrar por un instante el carrito del usuario anterior en la misma pestaña | Baja | Nuevo — diferido a sesión futura | `hooks/useCart.ts` (store con `useSyncExternalStore`); no corregido a propósito hoy por su bajo riesgo/beneficio (requiere login→logout→login sin recargar la página en la misma pestaña) |
| Duplicación del patrón `fetchX` + `loading`/`error`/`retry` en 7 hooks | Informativa | Nuevo — vigilar, no forzar extracción todavía | `hooks/useOrders.ts`, `useQuestions.ts`, `useReviews.ts`, `useSellerOrders.ts`, `useSellerProducts.ts`, `useMyTickets.ts`, `useFavorites.ts` |
| `cancelIfPending` no repone stock al cancelar un pedido pendiente | Media | Aceptado como deuda | [docs/BITACORA.md — Sesión 3, "(b) Deuda técnica y limitaciones vigentes", punto 2](BITACORA.md#b-deuda-técnica-y-limitaciones-vigentes) |
| Pedidos multi-vendedor comparten `orders.status`: mover la tarjeta de un vendedor cambia el estado del pedido completo, incluidos los ítems de otro vendedor | Media | Aceptado como deuda | [docs/BITACORA.md — Sesión 3, punto 3](BITACORA.md#b-deuda-técnica-y-limitaciones-vigentes) |
| `order_items.product_id` es `ON DELETE SET NULL`, no `RESTRICT`: solo el guard de aplicación en `seller.service.deleteProduct` evita perder reseñas/preguntas en cascada por un borrado directo en SQL | Media | Aceptado como deuda | [docs/BITACORA.md — Sesión 3, punto 6](BITACORA.md#b-deuda-técnica-y-limitaciones-vigentes) |
| `profiles` sin vista pública: nombres de otros usuarios no legibles (preguntas muestran "Usuario", reseñas "Comprador verificado") | Baja | Aceptado como deuda | [docs/BITACORA.md — Sesión 3, punto 1](BITACORA.md#b-deuda-técnica-y-limitaciones-vigentes) |
| Sin realtime: el comprador/vendedor ve cambios de estado solo al recargar | Baja | Aceptado como deuda | [docs/BITACORA.md — Sesión 3, punto 4](BITACORA.md#b-deuda-técnica-y-limitaciones-vigentes) |
| `hasRelevantContext` no es señal confiable de relevancia real, y el caso "laptops vs. accesorio" es no determinista (una mochila puntúa más alto que las laptops reales) — reproducido en vivo hoy con `ask_assistant` en 4 corridas de la misma consulta | Media | Aceptado como deuda | [docs/BITACORA.md — Sesión 4, "(b) Deuda técnica y limitaciones vigentes (nuevas de la sesión 4)", puntos 2 y 3](BITACORA.md#b-deuda-técnica-y-limitaciones-vigentes-nuevas-de-la-sesión-4) |
| `useChat`: la conversación no persiste (vive en memoria del navegador) y las respuestas no llegan por streaming | Informativa | Aceptado como deuda | [docs/BITACORA.md — Sesión 4, puntos 6 y 7](BITACORA.md#b-deuda-técnica-y-limitaciones-vigentes-nuevas-de-la-sesión-4) |

---

## Validación automática — estado final del repo tras los dos commits de corrección

- [x] Reglas de ubicación de `mercadotech-architecture-enforcer` (greps de capas de `CLAUDE.md`) sobre el código tocado: los 4 devuelven vacío
  - `grep -rl "@/lib/supabase" components hooks` → vacío
  - `grep -rl "from \"@/services" components` → vacío
  - `grep -rln "@huggingface" --include="*.ts" . | grep -v node_modules | grep -v lib/ai` → vacío (único match real: `lib/ai/embeddings.ts`)
  - `grep -rl "lib/supabase/admin" app components hooks services | grep -v "api/v1"` → vacío (único match fuera de `api/v1/reindex/route.ts` es un comentario en `services/embedding.service.ts`, no un import real)
- [x] Ningún hallazgo marcado "crítico" por `mercadotech-code-reviewer` sigue sin resolver: la revisión de `lib/ai/`, los 3 Route Handlers y `mcp/src/` no encontró errores críticos ni importantes; las dos únicas sugerencias ya están corregidas (commits `3947a4c` y `20c12f7`)
- [x] `npm run lint` (raíz) — exit 0, sin salida de ESLint
- [x] `npm run type-check` (raíz) — exit 0
- [x] `npm run build` (raíz) — exit 0, 19 rutas generadas
- [ ] `npm run test` — N/A (sesión 6): no existe el script en `package.json` de la raíz todavía
- [x] `mcp/`: cambio tocó `mcp/src/prompts/`, así que aplica — `npm run type-check` dentro de `mcp/` exit 0, y `npm run build` (tsup) exit 0 (`dist/index.js`, 1.37 MB, build success en 1.6s)

VALIDACIÓN APROBADA
