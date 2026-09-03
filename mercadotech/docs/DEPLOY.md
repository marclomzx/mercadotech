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
| `NEXT_PUBLIC_SITE_URL` | Vercel, por entorno (prod = URL real; preview = auto) | nadie todavía † | pública |
| `HUGGINGFACE_EMBEDDING_MODEL` / `HUGGINGFACE_CHAT_MODEL` (opcionales) | Vercel solo si se necesita rotar modelo | `lib/ai/` | pública |
| `UNSPLASH_ACCESS_KEY` | Local únicamente (`.env.local` del desarrollador) | `scripts/seed-images.ts` — mantenimiento del seed, no corre en producción | pública* |

† La spec describe `NEXT_PUBLIC_SITE_URL` como "redirects de auth", pero
**ningún archivo de código la lee** en este repositorio — ver
[§5, hallazgos del go-live](#next_public_site_url-no-la-lee-nadie). Se carga
igualmente, pero hoy es inerte.

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

Grep adicional, mismo espíritu — el ref del proyecto Supabase hosted (la
sub-referencia que forma `https://<ref>.supabase.co`):

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

Y repetido tras crear el proyecto de producción (Fase 7.4), buscando el ref
concreto sobre **lo que git tiene versionado**, que es lo que de verdad
importa:

```bash
git grep -n "<ref-del-proyecto>" HEAD -- .
```

Resultado: vacío. El ref existe en el disco en
`supabase/.temp/linked-project.json` —lo escribe `supabase link`— pero ese
directorio está en `supabase/.gitignore` (línea 3: `.temp`) y el archivo **no
está trackeado**, verificado con `git ls-files --error-unmatch`. El ref no es
un secreto (viaja al navegador dentro de `NEXT_PUBLIC_SUPABASE_URL`), pero
mantenerlo fuera del repositorio evita que una copia del proyecto apunte por
accidente a la base de datos de producción de otra persona.

```bash
git log --all -p -- .env.local
```

Resultado: vacío (sin salida — nunca se commiteó ese archivo en ninguna
rama).

## 2. Infraestructura de producción

| Pieza | Qué es | Dónde vive |
|---|---|---|
| Repositorio | `marclomzx/mercadotech` (público). La app Next vive en el subdirectorio `mercadotech/`, no en la raíz. | GitHub |
| CI | `.github/workflows/ci.yml` — jobs `checks` y `e2e`, sin secretos (sesión 6). | GitHub Actions |
| Base de datos | Proyecto `mercadotech-prod`, plan free, compute nano. 15 tablas, RLS activa, 2 buckets (`product-images`, `avatars`). | Supabase hosted |
| Aplicación | Proyecto `mercadotech`, Root Directory `mercadotech`, Next.js, Node 24. | Vercel |
| URL de producción | `https://mercadotech-gamma.vercel.app` | Vercel |

**Root Directory `mercadotech` no es opcional.** La raíz del repo solo contiene
`.github/`, los `.md` del curso y la carpeta de la app: no hay `package.json`
arriba. Con el Root Directory por defecto (`./`) el build muere al instante.
Vercel lo detectó solo al importar, pero es lo primero que hay que revisar si
un proyecto nuevo no arranca.

**Node 24 en Vercel** (Settings → General) para igualar el `NODE_VERSION: "24"`
del workflow: lo que valida el CI y lo que sirve producción corren sobre el
mismo runtime.

## 3. Flujo de despliegue

Vercel está conectado al repositorio por su **integración Git** (decisión 2).
No hay CLI de Vercel, ni tokens de despliegue, ni jobs de deploy en el
workflow: **el único disparador es el repositorio**. GitHub Actions valida;
Vercel despliega; ninguno de los dos conoce al otro.

```
  rama de trabajo ──push──> GitHub
         |
         +- abrir PR
              +--> GitHub Actions: checks -> e2e   (ambos REQUIRED)
              +--> Vercel: build de Preview con URL propia
                     |
              merge bloqueado hasta que los dos checks estén en verde
                     |
              merge a main
                     +--> Vercel: build de Production -> URL real
                     +--> GitHub Actions: CI de nuevo sobre main
```

### El candado de `main`

Reglas activas en Settings → Branches:

* Require a pull request before merging (**sin** exigir aprobaciones — en un
  repo de una sola persona, GitHub no deja aprobar el PR propio y la regla
  dejaría a su dueño encerrado)
* Require status checks to pass: **`checks`** y **`e2e`**
* Do not allow bypassing the above settings — aplica también al dueño

Nadie puede empujar a `main` directamente ni mergear con el CI en rojo.

### Qué dispara qué

| Acción | GitHub Actions | Vercel |
|---|---|---|
| `push` a una rama cualquiera | **nada** (el workflow solo escucha `main` y `pull_request`) | nada |
| abrir un PR | `checks` → `e2e` | build de **Preview** |
| `push` a la rama del PR | vuelve a correr | nuevo Preview |
| merge a `main` | corre sobre `main` | build de **Production** |

### Cambiar una variable de entorno

Editar una variable en Vercel **no toca los deploys ya hechos** (decisión 10):
el valor nuevo solo entra en el próximo build. El propio dashboard lo avisa
("A new deployment is needed for changes to take effect"). Después de cambiar
cualquier variable hay que **redesplegar** — o dejar que el siguiente merge lo
haga, si no corre prisa.

### Rollback

Vercel guarda **todos** los despliegues anteriores, ya construidos y servibles.
Volver atrás no reconstruye nada: se limita a apuntar el dominio de producción
a un build que ya existe. Por eso tarda segundos y no puede fallar por un error
de compilación.

### Cuándo usarlo

Cuando producción está rota **y no sabes todavía por qué**. Primero se restaura
el servicio, después se investiga con calma. Diagnosticar con el sitio caído es
la forma más rápida de tomar malas decisiones.

No lo uses para un fallo que ya tienes localizado y cuyo arreglo es de una
línea: para eso, el camino normal —rama, PR, CI, merge— tarda unos minutos más
y deja el historial limpio.

### Cómo se hace

1. Vercel → pestaña **Deployments** del proyecto
2. Localiza el último despliegue que **sí funcionaba** (la lista muestra el
   commit y la hora de cada uno)
3. Menú **⋯** de esa fila → **Promote to Production**

   *(Si esa opción no aparece, **Redeploy** sobre ese despliegue produce el
   mismo resultado: reconstruye ese commit y lo publica.)*

→ El dominio de producción sirve esa versión en segundos.

### Después del rollback: arreglar de verdad

Promover un despliegue antiguo **no cambia el código de `main`**. El commit
defectuoso sigue siendo la punta de la rama, y el siguiente merge volverá a
desplegarlo. El rollback compra tiempo; no arregla nada.

Para deshacerlo en el repositorio, con el candado de `main` puesto, el camino es
el normal:

```bash
git checkout main && git pull
git checkout -b fix/revertir-<lo-que-sea>
git revert <sha-del-commit-defectuoso>
git push -u origin fix/revertir-<lo-que-sea>
```

Después: PR → CI en verde → merge. El merge despliega solo, y producción vuelve
a estar alineada con `main`.

Se usa `git revert` y no `reset`: crea un commit nuevo que deshace el anterior,
sin reescribir historia — que además `main` no permitiría.

### Qué NO revierte un rollback de Vercel

Esto es lo importante y lo que más sorprende:

**La base de datos no vuelve atrás.** Vercel solo sirve la aplicación; los datos
viven en Supabase y ni los toca. Un rollback deja una app antigua hablando con
una base de datos actual.

En concreto, **nada de esto se deshace**:

| No se revierte | Por qué |
|---|---|
| Las migraciones aplicadas con `supabase db push` | Vercel no ejecuta migraciones y no sabe que existen |
| Los datos escritos por los usuarios | Pedidos, productos, reseñas: son datos reales, no artefactos del build |
| Los archivos subidos a Storage | Viven en el bucket de Supabase |
| Los embeddings de `knowledge_embeddings` | Los genera un script contra la base, no el build |
| Los cambios de configuración de Supabase | Ajustes de Auth, políticas RLS, claves |
| Las variables de entorno de Vercel | El rollback promueve un build; **el build ya tiene los valores incrustados con los que se construyó** |

**El caso peligroso:** un despliegue que incluye una migración con un cambio de
esquema incompatible hacia atrás — renombrar una columna, por ejemplo. Al
promover el despliegue anterior, esa app antigua sigue pidiendo la columna con
el nombre viejo, que ya no existe. El rollback no arregla el problema: lo
convierte en otro distinto.

**Regla práctica:** si el despliegue roto traía una migración, el rollback de
Vercel **no basta**. Hay que revertir el esquema con una migración nueva —
`supabase migration new` que deshaga el cambio, y `supabase db push`— porque el
esquema de la base solo se toca por migraciones del repositorio, nunca a mano en
el dashboard.

**La forma de no llegar ahí** es escribir las migraciones para que sean
compatibles hacia atrás mientras convive con ellas la versión anterior de la
app: añadir una columna nueva en vez de renombrar, y eliminar la vieja en un
despliegue posterior, cuando ya nada la use.

### Correr los E2E contra un Preview (manual, opcional)

Los E2E del CI corren siempre contra un Supabase efímero: **ningún test apunta
a producción**. Si alguna vez hace falta validar un Preview a mano:

```bash
PLAYWRIGHT_BASE_URL=<url-del-preview> npx playwright test --project=chromium
```

Es una herramienta puntual, **no parte del CI**, y hay que usarla sabiendo que
el Preview escribe en la base de datos de producción (decisión 9): los E2E
crean pedidos y publican productos reales.

## 4. Smoke test de producción

Ejecutado el 2026-09-02 sobre `https://mercadotech-gamma.vercel.app`, tras el
primer despliegue y el merge del PR #2.

| # | Comprobación | Resultado |
|---|---|---|
| 1 | La home carga (HTTP 200) | ✅ |
| 2 | Catálogo VACÍO con `EmptyState` — esperado, decisión 6 | ✅ |
| 3 | Favicon correcto en la pestaña | ✅ |
| 4 | Rutas públicas responden 200: `/`, `/categoria/laptops`, `/buscar`, `/login` | ✅ |
| 5 | Rutas protegidas redirigen (307): `/soporte`, `/carrito`, `/vendedor/productos` | ✅ |
| 6 | Ruta inexistente devuelve 404 | ✅ |
| 7 | Registro de un vendedor real, sin confirmación por correo | ✅ |
| 8 | Publicar productos con imagen desde la UI | ✅ (5 productos) |
| 9 | Los productos aparecen en el catálogo con su imagen | ✅ |
| 10 | La página de detalle abre correctamente | ✅ |
| 11 | `/soporte` responde citando la FAQ de producción | ✅ |
| 12 | Búsqueda semántica encuentra por significado, no por texto literal | ✅ |
| 13 | Logout / login | ✅ |
| 14 | El merge del PR llega a producción (footer nuevo visible) | ✅ |

**Lo que prueban los puntos 8 y 9 juntos:** las imágenes suben al bucket
`product-images`, el service resuelve su URL pública con `getPublicUrl`,
`next/image` la optimiza y el `remotePattern` `*.supabase.co` de
`next.config.ts` la deja pasar. Cuatro piezas que solo se validan de verdad
con un archivo real de por medio.

**Lo que prueba el punto 11:** la cadena completa del RAG en producción —
pregunta → embedding en Hugging Face → búsqueda vectorial sobre
`knowledge_embeddings` → contexto → respuesta con citas numeradas. La
respuesta reprodujo los plazos del artículo *"¿Cuánto tiempo tarda en llegar
mi pedido?"* y lo listó como fuente `[1]`.

## 5. Hallazgos del go-live

Cosas que costaron tiempo y conviene no volver a descubrir.

### Los tres interruptores del registro

El registro por correo depende de **tres** ajustes repartidos en la misma
página de Supabase (Authentication → Sign In / Providers), y apagar el que no
es produce errores que no se parecen entre sí:

| Ajuste | Dónde | Debe estar | Si está mal |
|---|---|---|---|
| `Enable Email provider` | Auth Providers → Email | **encendido** | *"Email signups are disabled"* |
| `Allow new users to sign up` | tarjeta User Signups | **encendido** | el registro se rechaza sin más |
| `Confirm email` | tarjeta User Signups | **apagado** | la cuenta se crea pero no se puede entrar (decisión 8) |

`Confirm email` está apagado **a propósito**: es una concesión de laboratorio.
Con él encendido, Supabase exige un clic en un correo de confirmación que no
llega, porque el SMTP de cortesía solo envía a direcciones del equipo del
proyecto. En un producto real se deja **encendido**, con SMTP propio.

### Rotación de la service role key

Durante el go-live la service role key quedó parcialmente visible en una
captura de pantalla. Se aplicó la regla de la sección 1 sin excepción: se creó
una clave nueva en formato `sb_secret_`, se sustituyó en Vercel, y se
**deshabilitaron las claves legacy en formato JWT** desde Supabase (Settings →
API Keys → Legacy API keys → *Disable JWT-based API keys*).

Nada se rompió al revocarlas: la anon key ya era del formato nuevo
(`sb_publishable_`), el entorno local usa el Supabase de Docker con sus propias
claves, y la indexación de la FAQ ya se había ejecutado.

**Recomendación derivada:** no revelar una clave secreta antes de capturar la
pantalla. Los tachones a mano no cubren lo suficiente.

### `NEXT_PUBLIC_SITE_URL` no la lee nadie

Está declarada en `.env.example`, en `.env.local` y en el workflow del CI, pero
**ningún archivo de código la consume** (verificado con `grep -rn` sobre todo
el repositorio). La tabla de gobernanza de la sección 1 la describe como
"redirects de auth", y eso no es cierto en este repositorio: la sesión se
maneja con cookies en `lib/supabase/middleware.ts`, que no necesita una URL
absoluta.

Se carga igualmente en Vercel (entorno Production) por coherencia con lo
documentado y porque el día que haga falta —recuperación de contraseña,
enlaces en correos— ya estará puesta. Pero hoy es **inerte**: no puede ser la
causa de ningún fallo.

### Tipos de variable en Vercel

Vercel distingue entre **Config** (legible después de guardar) y **Secret**
(write-only). La distinción coincide exactamente con la columna
pública/secreta de la tabla de la sección 1: las `NEXT_PUBLIC_*` deberían ser
**Config** —marcarlas como Secret no protege nada, porque viajan al navegador
igual, y solo impide releerlas para verificar un valor— y
`SUPABASE_SERVICE_ROLE_KEY` y `HUGGINGFACEHUB_API_TOKEN` deben ser **Secret**.

Una variable guardada como Secret **no se puede convertir a Config**: hay que
borrarla y volver a crearla. Por eso `NEXT_PUBLIC_SUPABASE_URL` y
`NEXT_PUBLIC_SUPABASE_ANON_KEY` quedaron como Secret en este proyecto — se
crearon así durante la importación. No afecta al funcionamiento (ambos tipos se
inyectan igual en el build); solo impide releer su valor desde el dashboard.
