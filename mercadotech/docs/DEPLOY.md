# Despliegue

## 1. Variables y secretos

`.env.example` es la fuente de verdad de qué variables existen y para qué
sirve cada una (comentarios ya completos, ver el archivo). Esta sección
audita **dónde vive** cada una en cada entorno y **quién la lee** — no
reescribe `.env.example` ni ningún código (decisión 5, ver
`../MercadoTech_sesion7.md`).

### Tabla de gobernanza

| Variable | Dónde vive | Quién la lee | Pública/Secreta |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel (Production + Preview), a mano | navegador y servidor | pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel (ambos entornos), a mano | navegador y servidor (RLS gobierna) | pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (ambos), a mano — solo runtime de servidor | `lib/supabase/admin.ts` en Route Handlers | **SECRETA** |
| `HUGGINGFACEHUB_API_TOKEN` | Vercel (ambos), a mano | `lib/ai/` vía Route Handlers | **SECRETA** |
| `NEXT_PUBLIC_SITE_URL` | Vercel, por entorno (prod = URL real; preview = auto) | redirects de auth | pública |
| `HUGGINGFACE_EMBEDDING_MODEL` / `HUGGINGFACE_CHAT_MODEL` (opcionales) | Vercel solo si se necesita rotar modelo | `lib/ai/` | pública |
| `UNSPLASH_ACCESS_KEY` | Local únicamente (`.env.local` del desarrollador) | `scripts/seed-images.ts` — mantenimiento del seed, no corre en producción | pública* |

*`UNSPLASH_ACCESS_KEY` no está en la tabla de la spec original (que lista 6
variables); la incluyo aquí porque existe en `.env.example` y hay que decir
dónde vive. No es secreta en el sentido de dar acceso a datos propios —
es una API key de un servicio gratuito de terceros — pero de todas formas
nunca se sube a Vercel: no la usa ningún código que corra en producción.

Y la fila que **no existe a propósito**: **GitHub Actions — ninguna
variable, ningún secreto.** El CI (`.github/workflows/ci.yml`) corre contra
un Supabase efímero que nace y muere dentro del job; sus credenciales se
leen en caliente con `supabase status -o json` porque son las mismas claves
demo públicas que la CLI genera siempre, no secretos reales (decisión 11,
sesión 6). Verificado con:

```bash
grep -n "secrets\." .github/workflows/ci.yml
```

Resultado: vacío (ninguna línea).

### Reglas

* **Nunca commitear `.env*.local`.** Ya está en `.gitignore` (línea 38:
  `.env*`, con excepción explícita de `.env.example` en la línea 39).
  Verificado además con `git log --all -p -- .env.local`: historial vacío,
  nunca se commiteó.
* **Rotación inmediata si una clave se expone** (aparece en un commit, un
  log de CI, un mensaje de chat, una captura de pantalla): regenerar la
  clave desde el dashboard correspondiente (Supabase → Project Settings →
  API para las claves de Supabase; Hugging Face → Settings → Access Tokens
  para `HUGGINGFACEHUB_API_TOKEN`) y actualizar el valor en Vercel. Una
  clave expuesta se trata como comprometida aunque el repo sea privado:
  ningún historial de git es un lugar seguro para guardar un secreto.
* **Los previews de Vercel comparten la base de datos de producción**
  (decisión 9): un solo proyecto Supabase por alumno, plan free — no hay
  un segundo proyecto para preview. Riesgo señalado: un deploy de preview
  (de una rama o PR) puede leer y escribir datos reales de producción. Es
  aceptable en este laboratorio; en un producto real la mejora sería un
  proyecto Supabase separado por entorno (o al menos una rama de Supabase),
  con sus propias variables de Preview en Vercel.
* **Cambiar una variable en Vercel no afecta a los deploys ya hechos**
  (decisión 10): Vercel solo inyecta el valor nuevo en el próximo build.
  Tras editar cualquier variable en el dashboard, hace falta un redeploy
  explícito (Deployments → ⋯ → Redeploy) para que el cambio llegue a la
  URL que están viendo los usuarios.

### Greps anti-fuga

Buscan valores reales de claves en el código — no nombres de variable, que
sí aparecen legítimamente por todo el proyecto. Excluyen `node_modules`,
`package-lock.json` y `.next/` (build local, no versionado). Se corrieron
desde la raíz del repo.

```bash
grep -rn "hf_" --include="*.ts" --include="*.tsx" --include="*.mjs" \
  --include="*.sql" --include="*.yml" --include="*.json" . \
  | grep -v node_modules | grep -v package-lock.json
```

Resultado (2 coincidencias, ambas texto de un mensaje de error — NO un
token real):

```
./mercadotech/lib/ai/completion.ts:78:          "Revisa HUGGINGFACEHUB_API_TOKEN en .env.local: debe empezar con hf_ " +
./mercadotech/lib/ai/embeddings.ts:67:          "Revisa HUGGINGFACEHUB_API_TOKEN en .env.local: debe empezar con hf_ " +
```

```bash
grep -rn "sb_secret" --include="*.ts" --include="*.tsx" --include="*.mjs" \
  --include="*.sql" --include="*.yml" --include="*.json" . \
  | grep -v node_modules | grep -v package-lock.json
```

Resultado: vacío.

```bash
grep -rn "eyJ" --include="*.ts" --include="*.tsx" --include="*.mjs" \
  --include="*.sql" --include="*.yml" --include="*.json" . \
  | grep -v node_modules | grep -v package-lock.json
```

Resultado: vacío.

Grep adicional (no pedido por la spec, pero mismo espíritu: el proyecto
Supabase hosted todavía no existe — Fase 7.4 — así que tampoco puede haber
su ref filtrado todavía; se deja la búsqueda documentada para repetirla
después de crear el proyecto prod):

```bash
grep -rn "supabase\.co" --include="*.ts" --include="*.tsx" --include="*.mjs" \
  --include="*.sql" --include="*.yml" --include="*.json" . \
  | grep -v node_modules | grep -v package-lock.json
```

Resultado (3 coincidencias, las 3 son el patrón comodín `*.supabase.co` de
`next.config.ts` para permitir cualquier proyecto hosted, o una URL de
ejemplo en el mock de tests — ningún ref de proyecto real):

```
./mercadotech/next.config.ts:26:        // Proyecto Supabase hosted (cualquier sub-referencia *.supabase.co).
./mercadotech/next.config.ts:28:        hostname: "*.supabase.co",
./mercadotech/services/test-utils/supabase-mock.ts:224:              config.storage?.publicUrl ?? `https://mock.supabase.co/storage/${bucket}/${path}`;
```

```bash
git log --all -p -- .env.local
```

Resultado: vacío (sin salida — nunca se commiteó ese archivo en ninguna
rama).
