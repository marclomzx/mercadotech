---
name: mercadotech-code-reviewer
description: Revisión de código ya escrito en MercadoTech, estilo informe de PR con calificación /10. Actívala DESPUÉS de escribir o modificar código, cuando te pidan cosas como "revisa este service", "haz code review de este cambio", "¿está bien lo que acabo de escribir?", "revisa el diff antes de commitear". NO la uses para decidir si un archivo va en cierta carpeta (esa es mercadotech-architecture-enforcer), para dar un veredicto binario aprobado/fallido (esa es mercadotech-automatic-validator), ni para juzgar decisiones de diseño de fondo o deuda técnica (esa es mercadotech-tech-lead) — esta Skill informa sobre lo escrito, nunca bloquea ni decide.
---

# Code Reviewer de MercadoTech

## Qué hace esta Skill

Revisa código YA ESCRITO contra las convenciones reales del proyecto y
produce un informe — no bloquea el trabajo, no decide dónde va un archivo,
no da un veredicto binario. **Esta Skill REPORTA, no edita código**: cada
hallazgo es una sugerencia con su porqué; aplicar la corrección es un paso
aparte.

## Checklist del dominio (cada ítem viene de CLAUDE.md o de la estructura real)

- **RLS:** ¿la operación nueva respeta las políticas existentes, o usa el
  cliente admin para esquivarlas sin justificación en un comentario? El
  cliente admin solo se justifica en `app/api/v1/**`, `scripts/**` o
  `mcp/src/context.ts` — y aun ahí, con el porqué escrito al lado del uso.

- **Snapshots de pedidos:** si el código toca `order_items`, ¿lee
  `title_snapshot`/`price_snapshot` (el precio del momento de la compra), o
  lee el precio ACTUAL de `products`? Mezclar ambos es un bug: un pedido
  histórico no debe cambiar si el vendedor edita el producto después.

- **Stock:** ¿toda mutación de `products.stock` pasa por el RPC
  `create_order_from_cart`, o hay un `UPDATE`/`.update()` directo a `stock`
  en otro lado? Fuera del RPC no hay bloqueo de fila — riesgo de vender el
  mismo stock dos veces.

- **Orden del pipeline RAG:** si el código toca búsqueda semántica o chat,
  ¿se preservó el orden `vector-search` (o `searchByQuery`) → `context-builder`
  → `lib/ai/completion`? ¿Los umbrales/límites usados (similitud, máximo de
  fuentes, tamaño de contexto, modelo) vienen de `lib/constants/ai.ts`, o
  quedaron sueltos en el archivo?

- **`numeric` como string:** las columnas `numeric` (`price`, `total`,
  `price_snapshot`) llegan como `string` desde PostgREST. ¿El service las
  convierte con `Number()` antes de devolverlas, o se filtró un `string`
  hasta un componente o un cálculo?

- **Componentes puros:** ¿algún archivo en `components/` hace fetching,
  tiene lógica de negocio, o guarda estado que no sea puramente de UI (un
  toggle, un input controlado)? Debería recibir todo por props.

- **`any` sin justificar:** ¿aparece `: any`, `as any`, o `@ts-ignore` sin
  un comentario que explique por qué no hay alternativa tipada?

- **Errores accionables:** ¿los mensajes de error dicen qué pasó y qué
  hacer (patrón 401 / modelo no disponible / cuota agotada de `lib/ai/`), o
  son genéricos tipo `"Error"` / `"Algo salió mal"` sin más contexto?

## Formato de salida

```
## Code Review — [archivo(s) revisado(s)]

**Calificación: X/10**

### Errores críticos
- [si hay] descripción + archivo:línea + por qué es crítico

### Errores importantes
- [si hay] descripción + archivo:línea + por qué importa

### Sugerencias
- [si hay] mejoras opcionales, no bloqueantes

[Si no hay hallazgos en alguna sección, se omite esa sección, no se deja vacía con "ninguno".]
```

La calificación baja por errores críticos (RLS esquivada sin justificar,
stock fuera del RPC, snapshot mal usado) mucho más que por sugerencias de
estilo — el peso de cada categoría no es lineal.

## Fuente de verdad

`CLAUDE.md` es la fuente de verdad de este proyecto. Ante una contradicción
entre esta Skill y `CLAUDE.md`, **gana `CLAUDE.md`** — releerlo antes de
aplicar la regla.
