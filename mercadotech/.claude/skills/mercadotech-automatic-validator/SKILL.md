---
name: mercadotech-automatic-validator
description: Portero binario de MercadoTech — VALIDACIÓN APROBADA o VALIDACIÓN FALLIDA, sin términos medios. Actívala al cerrar una tarea o fase, o cuando te pidan "corre el validator", "¿está listo esto para commitear?", "dame el veredicto final", "valida el estado del repo". NO la uses para dar un informe con nota o sugerencias (esa es mercadotech-code-reviewer), para decidir dónde va un archivo (esa es mercadotech-architecture-enforcer), ni para juzgar diseño o deuda técnica (esa es mercadotech-tech-lead) — esta Skill NO corrige nada, solo dictamina.
---

# Automatic Validator de MercadoTech

## Qué hace esta Skill

Corre una checklist FIJA y objetiva sobre el estado actual del repo y
dictamina un veredicto binario. **Un solo ítem fallido = todo falla.** No
existe "aprobado con observaciones" — o pasa todo, o es `FALLIDA`.

**Esta Skill REPORTA, no corrige.** Dice qué falló y dónde; la corrección
es un paso aparte, humano-supervisado.

## Checklist fija

- [ ] Las reglas de ubicación de `mercadotech-architecture-enforcer` pasan
  sobre el código tocado (los greps de esa Skill, sin resultados).
- [ ] Ningún hallazgo marcado como "crítico" por `mercadotech-code-reviewer`
  sigue sin resolver sobre el código tocado.
- [ ] `npm run lint` exit 0 — si no, FALLIDA (pegar el error tal cual salió).
- [ ] `npm run type-check` exit 0 — si no, FALLIDA (pegar el error tal cual salió).
- [ ] `npm run build` exit 0 — si no, FALLIDA (pegar el error tal cual salió).
- [ ] `npm run test` exit 0 — **obligatorio desde la sesión 6** (el script ya
  existe). Un solo test en rojo = FALLIDA; pegar el `AssertionError` tal cual,
  con archivo y línea. Ya no aplica el `N/A` de antes.
- [ ] `npm run test:e2e` exit 0 — **solo si el stack local está arriba**
  (`supabase status` responde sin error). Si Docker/Supabase están apagados,
  el ítem se marca `N/A (stack local apagado)` y NO cuenta como fallo: los
  E2E exigen la base sembrada. Si está arriba y falla, es FALLIDA.
  Antes de correrlos, **`supabase db reset`**: los E2E crean pedidos y mueven
  el kanban, así que una segunda corrida sobre la base sucia falla por
  precondición, no por un bug. Y correrlos con **paridad de producción**
  (`npm run build && npm run start` levantado antes): contra `next dev` hay
  fallos conocidos que NO son del producto — ver `docs/DEBUGGING.md` →
  "E2E que pasan en local y fallan en CI".
- [ ] Si el cambio tocó `mcp/`: `npm run type-check` dentro de `mcp/` exit 0
  (una vez que ese script exista, a partir de la Fase 5.2).

## Formato de salida

```
## Validación automática — [alcance revisado]

- [x] o [ ] cada ítem de la checklist, con el resultado real (exit code,
      o el mensaje de error pegado tal cual si falló)

VALIDACIÓN APROBADA
```

o

```
## Validación automática — [alcance revisado]

- [x] o [ ] cada ítem, igual que arriba

VALIDACIÓN FALLIDA

Motivo(s):
- [ítem] — [qué falló, archivo/línea si aplica]
```

Nunca "aprobado con observaciones", nunca un puntaje, nunca una
recomendación de mejora — eso es trabajo de `mercadotech-code-reviewer` o
`mercadotech-tech-lead`, no de esta Skill.

## Fuente de verdad

`CLAUDE.md` es la fuente de verdad de este proyecto. Ante una contradicción
entre esta Skill y `CLAUDE.md`, **gana `CLAUDE.md`** — releerlo antes de
aplicar la checklist.
