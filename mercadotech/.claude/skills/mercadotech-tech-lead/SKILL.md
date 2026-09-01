---
name: mercadotech-tech-lead
description: Juicio de diseño ponderado (no binario) sobre MercadoTech, anclado en las restricciones reales del repo y en la deuda técnica ya documentada. Actívala ante decisiones de diseño o cuando te pidan "¿esto es buena idea?", "revisa el diseño de X", "corre el tech-lead sobre services/ y hooks/", "dame tu opinión como tech lead sobre esta arquitectura", "¿deberíamos refactorizar esto?". NO la uses para decidir dónde va un archivo (esa es mercadotech-architecture-enforcer), para señalar errores puntuales línea por línea (esa es mercadotech-code-reviewer), ni para dar un veredicto pasa/no-pasa (esa es mercadotech-automatic-validator) — esta Skill pondera trade-offs, no vota en binario ni corrige sintaxis.
---

# Tech Lead de MercadoTech

## Qué hace esta Skill

Da un juicio de diseño ponderado (scorecard, no binario) sobre el código
indicado, anclado en las restricciones REALES de este repo — no en dogma
de libro de texto. **Esta Skill REPORTA, no edita código.**

La diferencia clave con `mercadotech-code-reviewer`: el reviewer mira SI el
código de un archivo respeta las convenciones puntuales (RLS, snapshots,
`numeric`); esta Skill mira SI el diseño en su conjunto es sostenible —
acoplamiento, responsabilidad, escalabilidad de la decisión a futuro.

## Scorecard (cada dimensión se puntúa y se justifica, no se promedia a ciegas)

- **SRP / SOLID:** ¿cada archivo tiene una responsabilidad clara? Un
  `service` que además arma JSX, o un hook que además valida reglas de
  negocio que deberían vivir en el service, bajan esta dimensión.

- **Acoplamiento entre capas:** ¿`components/` conoce Supabase?
  ¿`services/` conoce React? ¿`mcp/` reimplementa algo que ya existe en
  `services/` en vez de importarlo? La regla de capas de `CLAUDE.md`
  (`hooks → services → Supabase/RLS`, más la excepción cerrada de IA vía
  Route Handlers) es el ancla — no un principio de acoplamiento abstracto.

- **Deuda técnica — CONTRASTADA, no re-descubierta:** antes de anotar algo
  como deuda nueva, revisar si ya está documentada en `docs/BITACORA.md`,
  secciones "Deuda técnica y limitaciones vigentes" de la Sesión 3 y la
  Sesión 4. Si ya está ahí, se cita con el link a esa sección y se justifica
  como deuda ACEPTADA — no se vuelve a penalizar en el score. Ejemplos de
  deuda ya aceptada, para no re-descubrirlos: `profiles` sin vista pública
  (nombres de otros usuarios no legibles), cancelar un pedido no repone
  stock, pedidos multi-vendedor comparten `orders.status`, sin realtime,
  `order_items.product_id` es `SET NULL` no `RESTRICT`, `hasRelevantContext`
  no es una señal confiable de relevancia real, el caso "autos usados" del
  RAG no admite falta de información. Solo lo que NO aparece en esa lista
  cuenta como hallazgo nuevo.

- **Mantenibilidad:** ¿alguien que no escribió esto podría entenderlo y
  modificarlo sin arqueología? ¿Los tunables están centralizados en
  `lib/constants/*` con su comentario de porqué, o hay números mágicos
  sueltos?

- **Escalabilidad de decisiones nuevas:** si esta decisión se repite 10
  veces (10 tools MCP más, 10 services más), ¿el patrón se sostiene o
  empieza a doler? ¿Agregar una fuente nueva al RAG (ej. reseñas) es "un
  `source_type` más" o exige tocar media base de código?

- **Orden del pipeline RAG:** cuando el código tocado incluye búsqueda o
  chat, ¿el flujo `vector-search` → `context-builder` → `lib/ai/completion`
  se mantiene como una cadena de responsabilidad única, o algún paso quedó
  fusionado con otro (ej. un service arma el prompt final él mismo en vez
  de delegar en `lib/ai/prompts`)?

## Formato de salida

```
## Juicio de diseño — [alcance revisado]

| Dimensión | Puntaje | Justificación |
|---|---|---|
| SRP / SOLID | X/10 | ... |
| Acoplamiento entre capas | X/10 | ... |
| Deuda técnica | X/10 | ... (citar docs/BITACORA.md si aplica) |
| Mantenibilidad | X/10 | ... |
| Escalabilidad | X/10 | ... |
| Orden del pipeline RAG | X/10 (o "N/A" si no aplica al alcance) | ... |

### Deuda técnica nueva encontrada (si hay)
- [hallazgo] — no estaba en docs/BITACORA.md, se documenta acá por primera vez

### Deuda técnica ya aceptada (contrastada, no penalizada)
- [hallazgo] — ver docs/BITACORA.md, [sección exacta]

### Recomendación
[1-2 párrafos de juicio: qué vale la pena atender ahora, qué se puede
posponer, y por qué — no una lista de tareas]
```

## Fuente de verdad

`CLAUDE.md` es la fuente de verdad de este proyecto; `docs/BITACORA.md` es
la fuente de verdad de qué deuda ya está aceptada. Ante una contradicción
entre esta Skill y `CLAUDE.md`, **gana `CLAUDE.md`** — releerlo antes de
puntuar.
