---
name: mercadotech-architecture-enforcer
description: Gate de ubicación PREVIO a crear, mover o editar un archivo en MercadoTech. Actívala ANTES de escribir código nuevo, no después. Dispara con peticiones como "crea un componente que consulte productos directamente de Supabase", "agrega una página que traiga los pedidos", "necesito un hook que llame a fetch", "mueve este archivo a components/", "agrega una tool/resource al servidor MCP", "crea un endpoint REST para listar productos". NO la uses para revisar código ya escrito (esa es mercadotech-code-reviewer), para dar un veredicto final (esa es mercadotech-automatic-validator), ni para juzgar si una decisión de diseño es buena idea (esa es mercadotech-tech-lead) — esta Skill SOLO contesta "¿este archivo va aquí, con estas dependencias?".
---

# Architecture Enforcer de MercadoTech

## Qué hace esta Skill

Verifica **SOLO ubicación y dependencias** de un archivo nuevo o movido —
nunca estilo, naming, ni calidad de código (eso es
`mercadotech-code-reviewer`). Actúa **antes** de que el archivo se escriba:
si detecta una violación, la reporta y propone la ubicación correcta, sin
escribir nada.

**Esta Skill REPORTA, no edita código.** Rechazar significa decir por qué y
dónde debería ir — la corrección la aplica un paso aparte, humano-supervisado.

## Checklist (cada ítem es un grep o una lectura, no una opinión)

- ¿Un archivo dentro de `components/` importa `@/lib/supabase`,
  `@/services/*` o hace `fetch`/llama a Supabase directamente? → **rechazar**:
  el fetching va en un hook, que llama a un service. Verificar con:
  ```bash
  grep -rl "@/lib/supabase" components hooks
  grep -rl "from \"@/services" components
  ```
  Ambos deben devolver vacío (CLAUDE.md, "Verificación de capas").

- ¿Un archivo en `services/*.service.ts` importa `react`, `next/*`, o algo
  de `app/`? → **rechazar**: los services son lógica de negocio pura,
  llamados desde hooks, nunca al revés (CLAUDE.md, "Separación por capas").

- ¿Algo fuera de `lib/ai/` importa `@huggingface/*`? → **rechazar**.
  Verificar con:
  ```bash
  grep -rln "@huggingface" --include="*.ts" . | grep -v node_modules | grep -v lib/ai
  ```
  Debe devolver vacío (CLAUDE.md, "Verificación de capas").

- ¿Algo fuera de `lib/voice/` usa la Web Speech API o cualquier SDK de voz?
  → **rechazar**. Esta regla rige desde la sesión 8 (agente de voz), pero
  se aplica ya: `lib/voice/` es la única carpeta autorizada
  (CLAUDE.md, "Separación por capas").

- ¿Se importa el cliente admin (`lib/supabase/admin.ts` /
  `createAdminClient`) fuera de `app/api/v1/**`, `scripts/**` o
  `mcp/src/context.ts`? → **rechazar** y proponer la ubicación correcta.
  Verificar con:
  ```bash
  grep -rl "lib/supabase/admin\|createAdminClient" app components hooks services scripts mcp/src 2>/dev/null \
    | grep -v "^app/api/v1/" | grep -v "^scripts/" | grep -v "^mcp/src/context.ts$"
  ```
  Debe devolver vacío. El cliente admin bypasea RLS por completo — cualquier
  otra ubicación expone la service role key o abre un agujero de seguridad.

- ¿Se propone una nueva capa REST (Route Handler) para leer/escribir datos
  que ya funcionan vía `hooks → services → Supabase (RLS)`? → **rechazar**:
  "sin API REST paralela", salvo la excepción ya cerrada de la capa de IA
  (CLAUDE.md, "Reglas derivadas"). Un Route Handler nuevo solo se justifica
  si el dato requiere un secreto server-only (token de IA, service role) que
  no puede viajar al navegador.

- ¿Un número, URL, límite o umbral queda escrito directo en el código
  (`0.3`, `1000`, un modelo de IA, un tamaño máximo) en vez de vivir en
  `lib/constants/*.ts`? → **rechazar**. Los tunables de IA van en
  `lib/constants/ai.ts` específicamente (CLAUDE.md, "Separación por capas").

- ¿Un layout (Server Component, sin `"use client"`) intenta usar un hook
  directamente, o un componente en `components/` importa algo de `hooks/`?
  → **rechazar**: el punto de conexión es un componente cliente colocado en
  `app/` (ej. `ShopNavbar.tsx`, `SellerGuard.tsx`), no `components/`
  (CLAUDE.md, "Los layouts son Server Components...").

### Reglas específicas del servidor MCP (`mcp/`, sesión 5 — Fases 5.2-5.4)

- ¿Aparece lógica de negocio, validación de dominio, o una consulta a
  Supabase fuera de la carpeta `mcp/`? Si esa lógica es para el servidor
  MCP → **rechazar**: toda la lógica del servidor vive dentro de `mcp/`
  (`MercadoTech_sesion5.md`, checklist de la Fase 5.1).

- ¿Un archivo dentro de `mcp/src/` importa algo de `app/`, `components/` o
  `hooks/`? → **rechazar**. `mcp/` solo puede importar de `services/`,
  `lib/ai/`, `lib/constants/` y `types/` (`MercadoTech_sesion5.md`, Fase
  5.2, sección "Reglas").

- ¿Una tool, resource o prompt del servidor MCP reimplementa una consulta o
  regla de negocio que ya existe en un `service`, en vez de importarlo? →
  **rechazar**: "reutilizar, no reimplementar" es una decisión cerrada
  (`MercadoTech_sesion5.md`, Guía de lecciones, lección 6). Si de verdad
  falta un service (ej. un agregado que no existe todavía, como
  `getProductsByIds`), la derivación documentada va en `mcp/src/shared/`,
  componiendo services existentes — nunca una consulta de negocio nueva
  "porque era más corto".

## Formato de salida

Una de dos, sin término medio:

```
✅ Ubicación correcta.
   [una línea confirmando qué regla(s) se revisaron]
```

```
❌ Rechazado: [nombre de la regla violada]
   Archivo/import problemático: [ruta]
   Ubicación correcta: [ruta o capa donde debería ir]
   Grep para verificar después de mover: `[comando exacto]`
```

Si se detecta más de una violación, se listan todas antes de terminar — no
se corta en la primera.

## Fuente de verdad

`CLAUDE.md` es la fuente de verdad de este proyecto. Si algo en esta Skill
contradice lo que dice `CLAUDE.md` hoy, **gana `CLAUDE.md`** — releerlo
antes de aplicar la regla, porque puede haberse actualizado después de esta
Skill.
