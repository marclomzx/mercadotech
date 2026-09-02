# Runbook de depuración — MercadoTech

Esto se lee con un error en pantalla. Ve directo a la tabla de abajo:
busca tu mensaje **literal** y copia el primer comando.

Si tu error no está en la tabla, sigue el flujo de cinco pasos.

---

## El flujo, en cinco pasos

### 1. Síntoma

Escríbelo en una frase, sin interpretar todavía. "El carrito muestra 3
cuando agregué 2" es un síntoma. "Falla el hook" ya es una hipótesis.

### 2. Reproducir

**Un test que falla es la mejor reproducción que existe.** Convierte el
síntoma en un test antes de tocar código: si no logras escribir un test que
falle, todavía no entiendes el bug.

```bash
npm run test -- cart.service
```

Si es de pantalla, no de lógica:

```bash
npx playwright test buyer-flow --project=chromium --headed
```

### 3. Leer los logs

No adivines. Mira dónde ocurre de verdad:

| Dónde | Qué se ve ahí | Comando |
|---|---|---|
| Servidor Next | Errores de Route Handlers, `console.warn` del reindexado | la terminal donde corre `npm run dev` |
| Endpoint de chat | Fallos del proveedor de IA | misma terminal; busca `[chat]` o `[reindex]` |
| Postgres local | Errores de RLS, GRANT, constraints | `docker logs --tail 50 supabase_db_mercadotech` |
| PostgREST | Qué query llegó de verdad y con qué error | `docker logs --tail 50 supabase_rest_mercadotech` |
| Auth | Login que no entra | `docker logs --tail 50 supabase_auth_mercadotech` |

> `supabase logs` **no existe** en esta CLI. Para el stack local se usa
> `docker logs` con el nombre del contenedor (`supabase_<servicio>_mercadotech`).

### 4. Una sola hipótesis

Escríbela y di cómo la vas a descartar. Una, no tres. Si cambias tres cosas
a la vez y funciona, no sabes cuál era.

### 5. Fix, y el test pasa

El mismo test del paso 2, ahora en verde. Si el test no existía, queda como
red de seguridad.

---

## Cómo leer un fallo del CI

El CI son **dos jobs encadenados** (`.github/workflows/ci.yml`):

- **`checks`** — lint, type-check, tests unitarios, type-check del MCP. Rápido
  y sin Docker.
- **`e2e`** — solo corre si `checks` pasó. Levanta un Supabase efímero y corre
  Playwright en chromium.

### Paso 1: ¿qué job murió?

Si murió `checks`, el job `e2e` aparece **skipped** — eso no es un segundo
error, es el `needs:` haciendo su trabajo. Arregla `checks` primero.

### Paso 2: el paso exacto

Abre el job en la pestaña **Actions** y busca el paso con la ✗. El nombre te
dice casi todo: "Tests unitarios con cobertura" es distinto de "Correr los E2E".

### Paso 3: el artefacto

| Falló | Artefacto | Retención |
|---|---|---|
| `checks` | `coverage` (también se sube cuando pasa) | 7 días |
| `e2e` | `playwright-report` (**solo cuando falla**) | 14 días |

Si una corrida verde no tiene `playwright-report`, eso es correcto: se sube
solo en fallo, para no dejar cientos de MB colgando.

### Paso 4: abrir el reporte de Playwright descargado

Se descarga como `.zip` desde la sección **Artifacts** de la corrida. No lo
abras haciendo doble clic en el `index.html` (queda en blanco: necesita
servirse). Descomprime y sirve:

```bash
npx playwright show-report ruta/al/playwright-report
```

Ahí tienes, por cada test fallido: el paso exacto, el screenshot del momento
del fallo, el video y la traza navegable.

---

## Cómo pedirle debugging a Claude

Un pedido útil trae **cuatro cosas**. Sin ellas, la respuesta es adivinanza:

1. **El síntoma**, en una frase.
2. **Los pasos** para reproducirlo (o el test que falla).
3. **El log LITERAL**, copiado tal cual — sin resumir, sin "decía algo como".
   El código de error (`42501`, `23503`, `PGRST116`) suele ser la respuesta.
4. **Qué ya descartaste**, para no repetir el mismo camino.

Un ejemplo que sirve:

> "Al publicar un producto, la imagen no aparece. Pasos: login seller1 →
> /vendedor/publicar → subo un JPG → guardo. En la terminal del server sale
> `new row violates row-level security policy`. Ya verifiqué que el archivo
> pesa menos de 5 MB y que el bucket existe."

Uno que no sirve: *"no me funciona la subida de imágenes, ¿qué será?"*

---

## Errores típicos del stack

Cada entrada: el mensaje **literal** que vas a ver, la causa y el primer paso.

### `new row violates row-level security policy for table "X"`

**Causa:** la RLS rechazó el INSERT/UPDATE. El usuario no cumple la política
(no es el dueño, o el estado de la fila no es el que la política exige).

**Primer paso** — confirma con qué usuario estás escribiendo:

```bash
docker logs --tail 30 supabase_db_mercadotech
```

Luego compara contra la política en `supabase/migrations/*_create_rls_policies.sql`.
Recuerda: la UI solo debe ofrecer acciones que la RLS permitiría (defensa en
profundidad); si la UI la ofreció y la RLS la negó, el bug está en la UI.

### `permission denied for table X` (código `42501`)

**Causa:** falta el **GRANT** de la Data API. Es distinto de la RLS: la RLS
filtra *filas*, el GRANT habilita la *tabla* para el rol `anon`/`authenticated`.
Supabase hace `REVOKE` por defecto en `public`, así que sin GRANT explícito no
se ve nada.

**Primer paso** — mira si la tabla tiene GRANT:

```bash
grep -n "grant" supabase/migrations/*_create_rls_policies.sql
```

### `0 filas` sin ningún error

**Causa:** casi siempre RLS, no un bug. La política no deja ver esas filas y
PostgREST devuelve una lista vacía, no un 403. Ejemplo real del proyecto:
`getOrderById` de un pedido ajeno devuelve `null`, no un error de permisos.

**Primer paso** — comprueba si con `service_role` sí aparecen (Studio →
http://127.0.0.1:54323). Si ahí están y en la app no, es RLS.

### `Model X is not supported by any provider` / `is not a chat model`

**Causa:** el modelo gratuito de Hugging Face rotó. Pasa sin aviso.

**Primer paso** — cambia la **variable de entorno**, no el código:

```bash
# .env.local → HUGGINGFACE_CHAT_MODEL=<otro modelo probado>
```

> El resto de fallos de IA (401, 429, pestaña IA vacía, respuestas sin
> sentido) ya están en la tabla de síntomas de
> [docs/RAG.md](RAG.md#tabla-de-síntomas-y-diagnóstico). No se duplica acá.

### `expected 384 dimensions, not N`

**Causa:** el modelo de embeddings cambió y ya no produce vectores de 384.
La columna `embedding vector(384)` y la firma de `match_knowledge` tienen esa
dimensión grabada.

**Primer paso** — no toques la migración todavía. Verifica qué modelo se está
usando:

```bash
grep -n "EMBEDDING_MODEL\|EMBEDDING_DIMENSIONS" lib/constants/ai.ts .env.local
```

Cambiar de dimensión exige migración (`ALTER COLUMN`, recrear índice HNSW y
función) **y** regenerar todas las fichas: los vectores de dos modelos
distintos no son comparables.

### `npm error Missing: <paquete> from lock file`

**Causa:** el `npm` del runner es más nuevo que el que generó el
`package-lock.json`, y espera entradas de dependencias opcionales por
plataforma (las variantes Linux de swc, rollup, esbuild…) que ese lockfile no
escribió. `npm ci` no modifica el lockfile: aborta.

**Primer paso** — que el pin del CI coincida con `packageManager`:

```bash
grep -n "packageManager" package.json && grep -n "NPM_VERSION" ../.github/workflows/ci.yml
```

Los dos deben decir la misma versión.

### El servidor MCP arranca y el cliente no lo ve / JSON-RPC corrupto

**Causa:** algo escribió en **stdout**. Ese canal es exclusivo del protocolo
JSON-RPC; un solo `console.log` lo corrompe.

**Primer paso** — verifica que el guard siga siendo el primer import de
`mcp/src/index.ts`:

```bash
head -5 mcp/src/index.ts
```

`lib/stdout-guard.ts` redirige `console.log/info/warn` a stderr y debe
importarse **antes** que todo (los `import` de ESM se hoistean).

### `Cannot find module '@/services/…'` al lanzar el MCP

**Causa:** cwd equivocado. El alias `@/*` apunta a la raíz del proyecto Next.

**Primer paso** — lánzalo **desde `mercadotech/`**, nunca desde dentro de `mcp/`:

```bash
npx tsx mcp/src/index.ts
```

---

## Errores propios de la suite de pruebas

La tabla completa de síntomas de testing y CI está en
[`MercadoTech_sesion6.md`](../../MercadoTech_sesion6.md) → "Si algo falla:
síntomas y diagnóstico". Acá van solo los que se encontraron **ejecutando**
la sesión 6, con su mensaje literal.

### `Cannot find native binding` (al correr `npm run test`)

**Causa:** npm no instaló el binario nativo de la plataforma (bug conocido de
npm con dependencias opcionales). Apareció al instalar Vitest 4.x, que
arrastra `rolldown`.

**Primer paso** — comprueba versión de Node contra lo que exige el paquete:

```bash
node -v && npm ls vitest
```

En este proyecto se fijó **Vitest 3.2.7**, compatible con el Node local. No
subas a 4.x sin verificar `engines`.

### `Cannot find module 'tsup' or its corresponding type declarations`

**Causa:** el `tsconfig.json` de la raíz incluía `**/*.ts`, lo que arrastraba
`mcp/tsup.config.ts` al type-check y al `next build`. En local no se nota
porque `mcp/node_modules` ya está instalado; en un checkout limpio (CI),
revienta.

**Primer paso** — confirma que `mcp` siga excluido en la raíz:

```bash
grep -A3 '"exclude"' tsconfig.json
```

### `Process from config.webServer was not able to start. Exit code: 1`

**Causa:** el `npm run build` que Playwright lanza falló. El error real está
**arriba** de esta línea, no en ella.

**Primer paso** — reproduce el build en las mismas condiciones que el CI (sin
`.env.local`, con las tres variables explícitas):

```bash
npm run build
```

### `net::ERR_ABORTED; maybe frame was detached?`

**Causa:** con `next dev`, dos workers de Playwright pidiendo rutas nuevas a
la vez disparan compilaciones simultáneas que abortan la navegación en curso.

**Primer paso** — córrelo en serie para confirmar que es eso:

```bash
npx playwright test --project=chromium --workers=1
```

Si en serie pasa, no es un bug del producto: es la compilación bajo demanda
del dev server.

### E2E que pasan en local y fallan en CI

**Causa más común:** local corre contra `next dev`; el CI contra
`npm run build && npm run start`. Son entornos distintos (StrictMode, Fast
Refresh, compilación bajo demanda).

**Primer paso** — reproduce la paridad de producción localmente:

```bash
npm run build && npm run start
```

Y en otra terminal, la suite contra ese servidor. Si ahí pasa y en dev no
(o al revés), ya sabes de qué lado está la diferencia.

---

## La norma del ciclo

Al terminar cualquier feature, el orden es:

1. **`mercadotech-code-reviewer`** — informe sobre el código escrito.
2. **Correcciones** — paso aparte, humano-supervisado. Las Skills reportan,
   no corrigen.
3. **`mercadotech-automatic-validator`** — veredicto binario. Desde la sesión
   6 **corre los tests**: `npm run test` es obligatorio, y si el stack local
   está arriba, también `npm run test:e2e`.

Un test en rojo = `VALIDACIÓN FALLIDA`. No hay "aprobado con observaciones".
