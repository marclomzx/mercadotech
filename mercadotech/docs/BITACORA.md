# Bitácora del proyecto MercadoTech

Registro acumulativo, sesión más reciente primero. Cada entrada documenta qué
se construyó, qué se decidió y por qué, qué problemas aparecieron y qué quedó
fuera a propósito.

> **Nota sobre el historial de git.** Los 18 commits del repositorio se
> crearon **todos el 2026-08-31**, al cierre de la sesión 3: hasta ese
> momento el trabajo vivía sin versionar en el working tree. Por eso las
> fechas de los commits **no reflejan** cuándo se hizo cada fase, y los
> archivos que se tocaron en varias fases quedaron en un solo commit (su
> estado final). Los hashes son reales y agrupan el trabajo por fase; la
> cronología no es un replay fiel.
>
> Dos commits no corresponden a una sola fase: `cff5913` reúne **todas** las
> páginas de `app/` y los conectores hook↔componente (se reescribieron a lo
> largo de las fases 3.2–3.7, así que solo existe su estado final), y
> `a6494fa` es el `CLAUDE.md` de la sesión 2, que se había quedado sin
> versionar.

---

## Sesión 7 — Performance, secretos y despliegue a producción (2026-09-02)

**El sitio salió a producción:** <https://mercadotech-gamma.vercel.app>

Rango de commits: `5c31821` (cierre de la sesión 6) → `3754567`. Trece commits,
11 archivos tocados, +1.544 / −144 líneas. La mayor parte es documentación: el
código de producto cambió en 4 archivos y 48 líneas netas.

La **Fase 7.1** (pipeline de CI) no se ejecutó en esta sesión: ya estaba
construida en la 6.7. La spec lo reconoce y la marca como tal.

---

### Fase 7.2 — Performance y Core Web Vitals

`6ca1721` · `874e763` · `64dd809` · `e031acd` · `9312035` · `2fbbb98` · `fb6e5bf`

Se midió el estado inicial, se aplicaron optimizaciones **solo donde la medición
las justificaba**, y se volvió a medir. La norma que gobernó la fase: ningún
cambio sin su número de antes y de después; lo que no movió la aguja se revierte
y se documenta como intento fallido.

**Antes de medir hubo que arreglar el dataset.** Solo existía 1 objeto en el
Storage local: casi todas las tarjetas caían al placeholder y el LCP habría
salido artificialmente bueno. Se poblaron 16 imágenes reales con
`scripts/seed-images.ts` antes de tomar ninguna cifra.

**Bundle — First Load JS** (determinista, del resumen de `npm run build`):

| Ruta | ANTES | DESPUÉS | Δ |
|---|---|---|---|
| `/vendedor/publicar` | 277 kB | **256 kB** | **−21 kB** |
| `/vendedor/productos/[id]/editar` | 277 kB | **256 kB** | **−21 kB** |
| `/vendedor/pedidos` | 217 kB | **204 kB** | **−13 kB** |
| `/` (home) | 254 kB | 254 kB | — |
| `/producto/[id]` | 258 kB | 258 kB | — |
| _Compartido por todas_ | 102 kB | 102 kB | — |

**Lighthouse móvil, contra build de producción local:**

| Página | Performance | LCP | TBT | CLS |
|---|---|---|---|---|
| `/` (home) | **48** | 4,9 s | 3.650 ms | 0,084 |
| `/producto/[id]` | **70** | 1,8 s | 3.280 ms | 0 |
| `/asistente` | **76** | 2,8 s | 810 ms | 0 |

**Cuatro intentos, dos aceptados, uno corregido y uno revertido:**

1. `dynamic import` de `SortableImageGallery` — **aceptado**, −21 kB en las dos
   rutas del formulario de producto.
2. `dynamic import` de `OrdersKanban` — **aceptado**, −13 kB en el panel de
   pedidos. Ambos aíslan dnd-kit, que solo necesita el vendedor.
3. `ssr: false` en ambos imports — **corrección**. Se midió que el bundle era
   idéntico con y sin él: no aportaba nada y añadía latencia de carga de chunk,
   suficiente para que `seller-flow.spec.ts` superara su timeout de 30 s al
   correr en paralelo (pasaba en 19,2 s aislado). Se quitó.
4. `sizes` del grid + `priority` en la portada — **revertido** (`2fbbb98`).

El cuarto merece detalle porque es el que enseña algo. Los números de después
salieron **peores** (home 48 → 46, LCP 4,9 → 6,2 s). En vez de aceptarlos o
descartarlos como ruido, se comprobó de forma determinista: ejecutando JS en el
navegador se midió el ancho de imagen realmente solicitado a 375 px y 820 px de
viewport — **idéntico** con el `sizes` viejo y el nuevo. Y con `curl` se
verificó que el HTML del servidor **no contiene ninguna imagen de producto**, así
que `priority` no tenía nada que priorizar. El cambio era un no-op. Se revirtió.

**Un bug real encontrado de paso** (`9312035`): ESLint estaba analizando los
artefactos del propio Playwright (`e2e/playwright-report/trace/assets/*.js`, el
bundle minificado de su visor de trazas), 254 errores de código ajeno. Solo
aparecía si existían artefactos E2E en disco — es decir, a cualquiera que
siguiera la secuencia normal E2E → lint, y habría dictado `VALIDACIÓN FALLIDA`
del validator de la 6.8 por algo que no es del proyecto.

**Objetivos: qué se cumplió y qué no.**

| Objetivo | Estado | Evidencia |
|---|---|---|
| Reducir el bundle de las rutas pesadas | ✅ | −21 kB y −13 kB, reproducibles |
| Suites verdes tras cada cambio | ✅ | 292/292 unitarios · 8/8 E2E · lint · types · build |
| CLS < 0,1 | ✅ | 0,083–0,084 |
| LCP < 2,5 s en home | ❌ | 4,9–6,2 s |
| Lighthouse ≥ 90 en home y catálogo | ❌ | **48 / 46** |

**Por qué no se llegó al 90, sin rodeos.** Lighthouse pesa el TBT al 30 %; con
2.580–3.650 ms ese 30 % puntúa casi cero, así que aunque el LCP fuera perfecto
la home no pasaría de ~60. Y ninguna de las tres optimizaciones autorizadas toca
el TBT: viven en rutas que la auditoría ni visita. El LCP malo nace de que **el
catálogo se renderiza 100 % en el cliente** — el HTML del servidor llega sin
productos, y la cadena hasta la primera foto es descargar JS → hidratar → pedir
productos → pedir imagen. Ningún ajuste de `sizes` acorta esa cadena.

La recomendación queda escrita en `docs/PERFORMANCE.md`: reescribir el catálogo
como Server Component. Fuera del alcance de esta sesión, que endurece y publica
lo existente sin features nuevas.

---

### Fase 7.3 — Gobernanza de variables y secretos

`54e115f`

`docs/DEPLOY.md` sección 1: tabla de gobernanza (qué variable vive dónde, quién
la lee, pública o secreta), la fila que **no existe a propósito** —GitHub
Actions no recibe ninguna variable ni ningún secreto— y los greps anti-fuga con
su resultado pegado.

Los greps de `hf_`, `sb_secret` y `eyJ` sobre el código: limpios. Las dos únicas
coincidencias de `hf_` son el texto de un mensaje de error que explica el formato
del token. `git log --all -p -- .env.local`: vacío, nunca se commiteó.

**Desviación documentada:** la spec describe la tabla con 6 variables;
`.env.example` tiene **8**. Los dos modelos de Hugging Face son filas separadas
y existe `UNSPLASH_ACCESS_KEY`, que la spec no contempla. Se documentaron las 8.

---

### Fase 7.4 — Despliegue en Vercel con base de datos remota

`c925117` (seed de producción) · `0f50d16` (cambio del smoke) · `30f1ee3` (merge
del PR #2) · `f6c804b` (documentación)

Diez pasos, alternando trabajo automatizado y clics del operador humano en los
dashboards.

**1. `supabase/seed.prod.sql`** — 8 categorías + 10 artículos de FAQ. Cero
usuarios, cero productos, cero pedidos. Validado antes de tocar producción:
se cargó contra el esquema local dentro de una transacción que vacía esas dos
tablas y termina en `rollback` — 8 + 10 filas, 0 productos, base local intacta.

**2. Base hosted migrada** — las 24 migraciones aplicadas con `supabase db push`
sin cortes. Resultado verificado en el dashboard: **15 tablas**, RLS activa,
**2 buckets** (`product-images`, `avatars`), y el Advisor de Supabase sin
incidencias. El punto de riesgo previsto era `create_storage_buckets.sql`, que
hace `grant` sobre tablas propiedad de `supabase_storage_admin`: pasó limpio.

**3-4. Producción sembrada e indexada** — el seed por el SQL Editor, y después
`scripts/index-all.ts` con las variables de producción pasadas en línea, sin
tocar `.env.local`. Resultado: **10 filas en `knowledge_embeddings`**, todas con
`source_type = articulo_soporte`.

**5. Confirm email desactivado** en Authentication.

**6-7. Vercel** — repositorio importado por la interfaz. Root Directory
`mercadotech` (la app vive en un subdirectorio; con `./` el build muere al
instante), framework Next.js detectado, Node **24** para igualar el CI. Las
variables cargadas **a mano**, marcadas para Production y Preview, antes de
pulsar Deploy. Primer despliegue verde a la primera.

Verificación externa del primer deploy: HTTP 200 en 1,36 s; `/`,
`/categoria/laptops`, `/buscar` y `/login` en 200; `/soporte`, `/carrito` y
`/vendedor/productos` en **307** (el middleware protegiendo lo que debe);
`/no-existe` en 404; y **ninguna clave secreta en el HTML servido**.

**8. Branch protection** en `main`: PR obligatorio, `checks` y `e2e` como status
checks requeridos, y sin permitir bypass — aplica también al dueño del repo. Sin
exigir aprobaciones: en un repo de una sola persona, GitHub no deja aprobar el
PR propio y la regla dejaría a su dueño encerrado.

**9. Ciclo completo demostrado** (PR #2, rama `deploy-smoke`, un cambio de una
línea en el footer). La secuencia quedó capturada en sus dos estados:

- Con el CI en curso: *"Some checks haven't completed yet"*, botón de merge en
  gris, ambos checks etiquetados **`Required`**, y el Preview de Vercel ya
  desplegado con URL propia.
- Con el CI terminado: *"All checks have passed"*, botón verde.
  `checks` en **41 s**, `e2e` en **3 min** — la asimetría que justifica el
  `needs: checks` del workflow.

Tras el merge, producción sirvió el footer nuevo, verificado con `curl`.

**10. Smoke test: 14/14 ✅** sobre la URL real. Home, favicon, rutas públicas y
protegidas, 404, registro de un vendedor real sin confirmación por correo,
publicación de **5 productos con imagen**, catálogo, detalle, `/soporte`
respondiendo con citas a la FAQ de producción, búsqueda semántica, y
logout/login.

Las dos comprobaciones que más valen: publicar con imagen valida cuatro piezas
que solo se prueban con un archivo real (subida al bucket → `getPublicUrl` →
`next/image` → el `remotePattern` de `next.config.ts`); y `/soporte` valida la
cadena RAG entera en producción — la respuesta reprodujo los plazos del artículo
*"¿Cuánto tiempo tarda en llegar mi pedido?"* y lo citó como fuente `[1]`.

#### Qué falló durante el go-live y cómo se resolvió

| Síntoma | Causa real | Resolución |
|---|---|---|
| `supabase: no se reconoce como cmdlet` | La CLI **no estaba instalada** en la máquina del operador. El entorno de herramientas del asistente sí la tenía, y se reportó como si fuera el mismo sistema | `npm install -g supabase@2.116.0`. Corregido tras comprobar el Explorador de archivos del operador, que era la fuente de verdad |
| `BadResource: FileSystem.makeDirectory (...\npm\supabase\.temp)` | `supabase link` ejecutado desde la carpeta global de npm, no desde el proyecto | Ejecutar desde `mercadotech/` |
| `Invalid API key` al indexar | La clave se pegó **dentro del texto del prompt** de `Read-Host`, no como respuesta: la variable quedó vacía. Y era la clave publishable, no la secreta | Repetir con la sintaxis correcta y la clave `sb_secret_` |
| Service role key parcialmente legible en una captura | Los tachones a mano no cubrieron lo suficiente | **Rotación**: nueva clave `sb_secret_`, sustituida en Vercel, y las claves legacy JWT deshabilitadas. Se aplicó la propia regla escrita en la 7.3 |
| `Email signups are disabled` en el registro | Tres interruptores distintos gobiernan el registro y se apagó el que no era | `Enable Email provider` ON · `Allow new users to sign up` ON · `Confirm email` OFF |

#### Decisiones ejercidas en esta fase

**Todo el despliegue por la interfaz de Vercel, y los secretos cargados a mano**
(directiva del docente). No se instaló la CLI de Vercel, no se crearon tokens de
despliegue y no se añadió ningún job de deploy al workflow. La consecuencia de
diseño es limpia: **el repositorio es el único disparador**. GitHub Actions
valida, Vercel despliega, y ninguno de los dos conoce al otro ni comparte
credenciales con el otro.

**El seed de producción no crea usuarios ni productos.** El de laboratorio tiene
6 usuarios con contraseña compartida escrita en claro y 16 productos inventados:
eso no puede vivir en un sitio público. Consecuencia buscada y visible: el
catálogo de producción **nace vacío** y muestra el `EmptyState` hasta que un
vendedor real publica. No es un bug.

**Los previews comparten la base de datos de producción.** Un solo proyecto
Supabase en plan gratuito. El riesgo es real y queda señalado: un deploy de
preview lee y escribe datos reales. Aceptable en un laboratorio; en un producto
se separaría por entorno.

**"Confirm email" desactivado** en el proyecto de producción. Es una concesión de
laboratorio: con él activo, Supabase exige un clic en un correo que no llega,
porque el SMTP de cortesía solo envía a direcciones del equipo del proyecto. En
un producto real se deja activado, con SMTP propio.

---

### Fase 7.5 — Documentación final

`3754567`

- **`docs/PLAN_CURSO.md`** — el README anterior (el plan del curso) movido
  **intacto**, verificado línea por línea contra el original en git; la única
  diferencia es CRLF → LF. Lleva una nota de contexto al inicio.
- **`README.md`** — nuevo, de producto: qué hace, stack, capas con su porqué,
  flujo del RAG, puesta en marcha desde `git clone` paso a paso, comandos,
  testing con su prerrequisito, deploy, URL de producción y estructura comentada.
- **`mercadotech/README.md`** — era el de `create-next-app`, sin una línea cierta
  sobre el proyecto. Ahora apunta al README de producto. *No estaba en la spec;
  se cambió porque dejarlo contradecía el objetivo de la fase.*
- **`docs/ARQUITECTURA.md`** — 471 → 670 líneas. La cabecera decía "hasta el
  cierre de la sesión 2" y "no hay todavía pantallas, hooks, services ni
  endpoints": falso desde hacía cuatro sesiones. Secciones nuevas 9 a 13
  (frontend, RAG, Skills + MCP, testing + CI, despliegue) y una tabla de
  desviaciones donde gana el código.
- **`docs/DEPLOY.md`** — sección de rollback: cuándo usarlo, los clics exactos,
  cómo arreglarlo de verdad después con `git revert` + PR, y **qué NO revierte**
  (migraciones, datos de usuarios, Storage, embeddings, configuración de Supabase
  y variables de entorno, porque el build ya las lleva incrustadas).

**Prueba del desarrollador nuevo**, ejecutando los comandos del README en su
orden: `npm ci` ✅ (516 paquetes) · `supabase status` ✅ · `.env.example` ✅ ·
`lint` ✅ · `type-check` ✅ · `test` ✅ **292/292 en 21 archivos** · `build` ✅
19 páginas. Enlaces relativos de los cinco documentos: 0 rotos.

`npm ci` falló en el primer intento con `EPERM ... next-swc.win32-x64-msvc.node`:
el servidor de producción que quedó corriendo desde la 7.2 tenía bloqueado el
binario nativo de Next, y `npm ci` necesita borrar `node_modules` entero. Se
cerró ese proceso y se repitió. El aviso quedó escrito en el README, porque
cualquiera con `npm run dev` abierto choca con lo mismo.

---

### Desviaciones respecto de la spec

Donde la especificación y el código no coinciden, manda el código:

| Dice la spec | Dice el repositorio |
|---|---|
| El build usa Turbopack (decisión 3) | `"build": "next build"`, sin el flag. Es webpack. La decisión de no usar bundle-analyzer se mantuvo igualmente, por restricción explícita de la fase |
| `.env.example` tiene 6 variables | Tiene **8** |
| `NEXT_PUBLIC_SITE_URL` sirve para los redirects de auth | **Ningún archivo la lee.** La sesión se maneja con cookies en `lib/supabase/middleware.ts`. Se carga igual, por coherencia, pero hoy es inerte |
| El repositorio es `growlearnjo/mercadotech` | Es `marclomzx/mercadotech`. El operador ya lo había corregido en su copia de la spec |
| Lighthouse ≥ 90 en home y catálogo | **48 / 46.** No alcanzado; ver el análisis de la 7.2 |

---

### Qué quedó fuera, a propósito

- **Un proyecto Supabase de staging.** Los previews siguen sobre la base de
  producción (decisión aceptada, riesgo documentado en `DEPLOY.md`).
- **E2E contra los previews dentro del CI.** Queda **anotado** en `DEPLOY.md`
  como herramienta manual (`PLAYWRIGHT_BASE_URL=<url> npx playwright test`), no
  como parte del pipeline: ningún test debe apuntar a producción, y un preview
  escribe en ella.
- **Bundle analyzer.** Prohibido por la fase; la medición se hizo con el resumen
  de tamaños por ruta de `next build`, que es determinista y suficiente.
- **El rollback está documentado pero no ejercitado.** No hubo ningún despliegue
  roto que lo justificara, y provocar uno para probarlo habría dejado el sitio
  público caído. Pendiente de validar la primera vez que haga falta.
- **Lighthouse contra la URL de Vercel.** Todas las mediciones son locales. La
  medición que cuenta para el criterio de aceptación —el servidor sin competir
  por CPU con Docker y 12 contenedores— **no se tomó**.

---

### Criterios de aceptación de la sesión

| Criterio | Estado | Evidencia |
|---|---|---|
| PR de prueba con CI y preview de URL propia; merge bloqueado en rojo y permitido en verde; el merge actualiza producción | ✅ | PR #2. Capturas de los dos estados; `checks` 41 s, `e2e` 3 min; footer nuevo verificado con `curl` en producción |
| La URL de producción pasa el smoke test completo | ✅ | 14/14, incluyendo 5 productos publicados con imagen y `/soporte` citando la FAQ |
| Lighthouse ≥ 90 en Performance para home y catálogo | ❌ | 48 / 46 en local. **No se midió contra la URL de Vercel** |
| Un desarrollador nuevo levanta el proyecto solo con el README | ✅ | Secuencia completa ejecutada en orden, todos exit 0 |
| `lint`, `type-check`, `test` y `build` verdes al cierre | ✅ | Los cuatro exit 0; 292/292 tests |

### Entregables

| # | Entregable | Estado | Evidencia |
|---|---|---|---|
| 1 | Branch protection con `checks` y `e2e` obligatorios | ✅ | API pública: `protected: true`; PR #2 bloqueado en amarillo |
| 2 | `docs/PERFORMANCE.md` con métricas antes/después | ✅ | 276 líneas; 4 intentos, 2 aceptados, 1 corregido, 1 revertido |
| 3 | `docs/DEPLOY.md` completo (variables, flujo, smoke, rollback) | ✅ | 419 líneas, 5 secciones |
| 4 | App desplegada sobre la BD hosted migrada y sembrada | ✅ | <https://mercadotech-gamma.vercel.app> |
| 5 | `README.md` de producto + `PLAN_CURSO.md` + `ARQUITECTURA.md` al día | ✅ | `3754567` |
| 6 | Bitácora y `CLAUDE.md` actualizados | ✅ | Esta entrada |

---

### Pendientes para la sesión 8

- **La 8 reutiliza `get_order_status` del servidor MCP** y amplía `/soporte` con
  voz (STT/TTS del navegador) sobre la base de conocimiento y los tickets que ya
  existen.
- Medir Lighthouse contra la URL de Vercel, que es la medición que el criterio de
  aceptación pedía de verdad.
- El catálogo como Server Component, si se quiere atacar el LCP en serio
  (recomendación medida en `docs/PERFORMANCE.md`).
- **Deuda heredada que sigue abierta:** `supabase/tests/` continúa con solo un
  `.gitkeep` — faltan los scripts de validación de RLS de la Fase 2.6; y de la
  sesión 1 siguen sin existir `docs/COSTOS.md` y `docs/PROMPTS.md`.

## Sesión 6 — Testing, debugging y CI con GitHub Actions (2026-09-01 / 2026-09-02)

**Alcance:** red de seguridad completa sobre MercadoTech: 292 tests unitarios
(Vitest) sobre lógica pura y services con Supabase inyectado, 8 specs E2E
(Playwright) sobre los flujos comprador y vendedor, y un pipeline de CI en
GitHub Actions que corre todo en cada push y PR. 63 archivos, +11011/-3930
líneas (`git diff --stat 269d0e3..HEAD`).

> **Desviación de la spec, misma clase que otras sesiones:** el Prompt 0 de
> esta sesión cita el commit `eed65ff` como cierre de la sesión 5. Ese hash
> **no existe** en el historial — el cierre real es `269d0e3` ("docs: add
> project log and update CLAUDE.md at close of Sesión 5"). Se usa ese en
> todo este documento.

> **Cambio de alcance decidido por el docente (registrado en la propia
> spec, `MercadoTech_sesion6.md`):** esta sesión ABSORBE el pipeline de CI
> de GitHub Actions, antes planeado como Fase 7.1. La sesión 7 conserva
> performance, secretos y despliegue en Vercel — sin CI, porque ya quedó
> resuelto acá.

### Prompt 0 — Conexión a GitHub e instalación de herramientas (commits `62aae54`, `1c09e1d`)

**Construido:** remoto `origin` conectado a
`https://github.com/marclomzx/mercadotech.git`, rama local renombrada
`master` → `main` (la spec y el CI asumen `main`), `vitest` +
`@vitest/coverage-v8` y `@playwright/test` + sus 3 navegadores instalados.

**Problema — el repo remoto no estaba vacío pese a la spec:** al crearlo en
GitHub quedó marcada "Add a README", así que trajo un commit propio
(`0e27116`, README de una línea) que chocó con el primer push. Se resolvió
con `git merge --allow-unrelated-histories`, conservando el README real del
proyecto (commit `1c09e1d`) — nada se perdió.

**Decisión — Vitest se fija en `3.2.7`, no en la última versión:** instalar
`vitest@latest` (4.1.11) rompió el entorno: arrastra `rolldown`/`vite@8`,
que en Windows con Node local (`v20.13.1`) ni siquiera resuelve el binding
nativo. `3.2.7` es la última versión de la familia 3.x, sin esa
dependencia, compatible con el Node de la máquina.

### Fase 6.1 — Infraestructura de Vitest (commit `89488fc`)

**Construido:** `vitest.config.ts` (environment `node` — sin jsdom, decisión
6: esta sesión no testea componentes React), alias `@/` igual que
`tsconfig.json`, cobertura v8 acotada a `lib/` y `services/`; scripts
`test`, `test:watch`, `test:coverage`.

### Fase 6.2 — Tests de lógica pura (commit `0c5b7fa`)

**Construido:** 78 tests sobre `lib/validators/{auth,product}.ts` (100 % de
ramas), `lib/utils.ts` (`cn`, `formatPrice` — sin fechas, decisión 3: no
existen en el código), `lib/ai/context-builder.ts` (100 % de ramas) y
`lib/ai/prompts.ts`. Cero mocks: todo el código bajo prueba es puro.

### Fase 6.3 — Tests de services con Supabase mockeado (commit `d2d41ba`)

**Construido:** `services/test-utils/supabase-mock.ts` (fábrica encadenable
programable por tabla/operación), 15 archivos de test de services y
`hooks/useSellerOrders.test.ts` (el helper `canMove` del kanban, exportado
sin cambio de lógica — ya estaba exportado, contra lo que la spec asumía).

**Decisión — mockeo de dos niveles (decisión 7 de la spec):** el cliente
Supabase se INYECTA siempre (mock construido en el test); `lib/ai/*` es la
única excepción, mockeada con `vi.mock` de módulo porque `chat.service` y
`embedding.service` la importan directo (diseño de la sesión 4, sin
parámetro por donde sustituirla). Documentado con comentario en cada test
que usa la excepción.

**Hallazgos anotados, NO corregidos (decisión 5 — el test documenta el
contrato real):**
1. `cart.service.addItem` no valida el signo de `quantity`: una cantidad
   negativa reduce el carrito en vez de rechazarse.
2. Si el total resultante queda ≤ 0 con stock abundante, el mensaje de
   error dice "Este producto no tiene stock disponible" aunque la causa sea
   otra.

### Fase 6.4 — Infraestructura de Playwright (commit `88a5427`)

**Construido:** `playwright.config.ts` (webServer: `build && start` en CI,
reutiliza `npm run dev` en local), 7 Page Objects, `e2e/data/users.ts`
(seed), `e2e/data/product-image.jpg` (JPEG real generado con Pillow), smoke
`home.spec.ts`; `data-testid` en 14 componentes (grep pasó de 0 a 14
archivos tocados) — solo el atributo, verificado archivo por archivo antes
de commitear.

**Decisión:** dos componentes (`Price`, `OrderStatusBadge`) no aceptaban
props extra, así que se les agregó `"data-testid"?: string` como prop
opcional reenviada a su elemento raíz — mismo criterio que "solo el
atributo", sin tocar estructura ni estilos.

### Fase 6.5 — E2E: flujo comprador (commit `15b9254`)

**Construido:** `buyer-flow.spec.ts` (8 pasos con `test.step`, aserciones
sobre el pedido RECIÉN creado por id de la URL) y `buyer-negative.spec.ts`
(stock 0, carrito vacío, anónimo redirigido).

**Hallazgo real de entorno, diagnosticado y no maquillado:** bajo `next
dev`, un click sobre un `DropdownMenuItem` que envuelve un `<Link>`
navega de forma intermitente — carrera entre el cierre del menú (base-ui)
y la navegación de Next, agravada por React StrictMode/Fast Refresh.
Verificado dos veces contra `next build && next start`: 100 % estable. No
es un bug de producto; es exactamente lo que la decisión 12 de la spec ya
anticipaba (por eso el CI usa build de producción). Se agregó un helper de
reintento en `e2e/pages/interactions.ts` como buena práctica, y la
verificación de esta fase se hizo contra el build de producción.

### Fase 6.6 — E2E: flujo vendedor (commit `658b5ed`)

**Construido:** `seller-flow.spec.ts` (publicar producto, mover el kanban
por TECLADO, verificar persistencia tras `page.reload()`, y que el
comprador vea el nuevo estado) y `seller-negative.spec.ts` (buyer1 fuera del
panel, retroceso de estado rechazado).

**Corrección de datos, verificada contra el seed real:** la spec (y el
prompt de esta fase) asumían que `c…03` está `'pagado'` y que `c…04` es
multi-vendedor `'enviado'`. `supabase/seed.sql` dice otra cosa: `c…03` ya
nace `'enviado'` (de seller2), `c…04` está `'entregado'`. El único pedido
`'pagado'` del seed es **`c…02`** (multi-vendedor, comprador buyer1) — ese
es el que el flujo positivo mueve, y `c…03` el que usa el negativo de
retroceso.

**Hallazgo real de CI, no de producto:** en el runner (más lento que la
máquina local), el `Space` de soltar la tarjeta llegaba antes de que la
flecha terminara de procesarse — la tarjeta se soltaba en su propia
columna y el movimiento nunca ocurría. Corregido esperando estado
observable de dnd-kit (`aria-pressed="true"` al tomar, el anuncio de
accesibilidad "sobre la columna X" antes de soltar) en vez de asumir que
cada tecla ya surtió efecto.

### Fase 6.7 — Pipeline de CI en GitHub Actions (commits `aa04165`,
`a322e0b`, `bbd7dfb`, `134f11d`, `5d0746c`)

**Construido:** `.github/workflows/ci.yml` con los jobs `checks` (lint,
type-check, tests con cobertura, type-check de `mcp/`) y `e2e` (needs:
checks; Supabase efímero; Playwright chromium); `packageManager:
"npm@11.6.2"` en `package.json`. Cero secretos.

**Decisión — pin de npm (decisión 10):** el runner instala
`npm@11.6.2` global antes de `npm ci`, coincidiendo con `packageManager`.
Evita que una versión de npm más nueva que la que generó el lockfile espere
entradas de dependencias opcionales por plataforma que ese lockfile no
escribió (`Missing ... from lock file`). Verificado contra el lockfile
real: trae las variantes Linux de los 6 paquetes nativos del proyecto.

**Decisión — credenciales dinámicas (decisión 11):** el job `e2e` lee
`supabase status -o json` + `jq` y pasa `API_URL`/`ANON_KEY` como env del
paso de tests. No son secretos: `supabase start` genera siempre las mismas
claves demo públicas, sobre una base que vive y muere dentro del runner.

**Tres corridas rojas antes de la verde, cada una diagnosticada hasta la
causa real (ninguna resuelta debilitando un test):**
1. `tsconfig.json` de la raíz incluía `mcp/tsup.config.ts` (`**/*.ts` sin
   excluir `mcp`), así que `next build` dependía de que `mcp/node_modules`
   existiera. Local nunca falló porque ya estaba instalado. Corregido
   agregando `mcp` al `exclude` de la raíz.
2. La misma carrera de teclado del kanban descrita en la Fase 6.6, vista
   por primera vez en el runner.
3. (Diagnóstico intermedio) un paso temporal de logging del build, retirado
   en el commit siguiente en cuanto confirmó la causa #1.

**Verificado en vivo, con evidencia de la pestaña Actions:** push a `main`
con ambos jobs en verde (`checks` 38s, `e2e` 259s — corrida #9,
`426604c`); PR #1 (`ci-smoke → main`) con un test roto puesto en rojo con
el `AssertionError` exacto, revertido, verde, y cerrado sin merge
(`merged: false`, confirmado por API).

**Hallazgo, no corregido — es decisión del usuario:** el repositorio quedó
**público**, no privado como pedía la spec. Verificado (`git ls-files`) que
no hay secretos commiteados; solo `.env.example`.

### Fase 6.8 — Debugging y actualización de los gates (commit `426604c`)

**Construido:** `docs/DEBUGGING.md` (flujo síntoma→reproducir→logs→
hipótesis→fix, cómo leer un fallo de CI, cómo pedirle debugging a Claude,
tabla de errores típicos del stack con mensaje literal); actualización
quirúrgica de `.claude/skills/mercadotech-automatic-validator/SKILL.md`:
`npm run test` pasa a obligatorio, `npm run test:e2e` obligatorio solo si
el stack local está arriba.

**Verificado con el gate real:** se rompió una aserción a propósito → el
validator (aplicando la checklist actualizada, ya que la Skill cargada en
sesión seguía en caché) dio `VALIDACIÓN FALLIDA` citando el
`AssertionError` con archivo y línea → se revirtió → `VALIDACIÓN APROBADA`
con los 292 tests y los 8 E2E en verde.

**Hallazgo propio del ejercicio:** correr `test:e2e` dos veces sin
`supabase db reset` entre medio da una `VALIDACIÓN FALLIDA` que no es un
bug — el segundo run hereda el estado que dejó el primero (el pedido ya
movido). Se agregó esa precondición a la regla del ítem en la Skill.

### Números finales de la sesión

| Métrica | Valor |
|---|---|
| Tests unitarios | 292, en 21 archivos, todos verdes con Docker apagado |
| Cobertura de `services/` | 100 % líneas · 99.23 % ramas (gate: ≥ 80 % líneas) |
| Cobertura de `lib/validators/` y `context-builder.ts` | 100 % ramas |
| Specs E2E | 8 (home, buyer-flow, buyer-negative ×3, seller-flow, seller-negative ×2), chromium |
| Job `checks` en CI | 38 s (corrida #9, `426604c`) |
| Job `e2e` en CI | 259 s (mismo run) |
| `data-testid` agregados | 14 componentes, solo el atributo |

### Fuera de alcance a propósito

* **Tests de componentes React** (decisión 6): esta sesión solo cubre
  lógica pura, services y flujos E2E — ningún componente se testea con
  Testing Library, que ni se instaló.
* **Tests del servidor MCP:** solo su `type-check` entra al job `checks`;
  `mcp/src/` no tiene suite propia.
* **Branch protection y deploy:** eso es sesión 7. El CI corre y reporta,
  pero nada impide mergear con un check en rojo todavía.
* **Secretos de producción, performance, Core Web Vitals:** sesión 7.

---

### (a) Criterios de aceptación de la sesión

| Criterio | Estado | Evidencia |
|---|---|---|
| `npm run test` verde con Docker apagado, cobertura objetivo | ✅ | Fase 6.3: 292/292 con Docker detenido y verificado; `services/` 100 % líneas |
| `npm run test:e2e` verde contra Supabase local con el seed | ✅ | Fases 6.5/6.6: 8/8, más el job `e2e` del CI contra un Supabase efímero |
| Kanban drag & drop cubierto por E2E vía teclado | ✅ | Fase 6.6: `focus → Space → ArrowRight → Space`, sin mouse, con estado observable de dnd-kit |
| Push y PR de prueba muestran ambos jobs en verde; un test roto los pone en rojo | ✅ | Fase 6.7: run #9 verde; PR #1 rojo→verde→cerrado sin merge, confirmado por API |
| La Skill validator ejecuta los tests como parte del gate | ✅ | Fase 6.8: demostrado en vivo, `VALIDACIÓN FALLIDA` → revert → `VALIDACIÓN APROBADA` |
| `lint`, `type-check` y `build` pasan | ✅ | Verificado al cierre de cada fase, local y en CI |

### (b) Deuda técnica y limitaciones vigentes (nuevas de la sesión 6)

1. **`cart.service.addItem` no valida el signo de `quantity`** (Fase 6.3,
   ver arriba) — comportamiento real, anotado, no corregido.
2. **El repositorio es público**, no privado — decisión pendiente del
   usuario, sin impacto de seguridad hoy (cero secretos commiteados).
3. **La rama `ci-smoke` sigue publicada en el remoto**, sin mergear —
   evidencia intencional del ejercicio de la Fase 6.7; se puede borrar
   cuando se quiera.
4. **El grep de capas #4 del validator tiene un falso positivo** contra
   `services/embedding.service.ts`: marca una mención en comentario
   ("este service no puede importar `lib/supabase/admin.ts`"), no un
   import real. Verificado, no corregido — no es código de esta sesión.

### (c) Pendientes

**Heredados de sesiones anteriores (sin cambios en esta sesión):**

- **Sesión 1 completa:** sigue sin ejecutarse. Faltan `docs/COSTOS.md` y
  `docs/PROMPTS.md`.
- **Fase 2.6:** `supabase/tests/` sigue vacío (solo `.gitkeep`). Faltan los
  scripts de validación RLS.

**Para la sesión 7** (performance, secretos y despliegue — el CI que antes
era Fase 7.1 ya quedó resuelto en esta sesión, no vuelve a aparecer):

- Auditoría de performance / Core Web Vitals.
- Manejo de secretos de producción (hoy `.env.local` es manual).
- Despliegue a Vercel: la app hoy apunta a
  `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` (local) y no hay
  `vercel.json` ni proyecto vinculado — el sitio NO está en línea todavía.
- Branch protection en GitHub (checks obligatorios para mergear).
- Documentación final del proyecto.

---

## Sesión 5 — Servidor MCP y ciclo de gobernanza (2026-08-31 / 2026-09-01)

**Alcance:** servidor MCP de solo lectura (`mcp/`) que expone el catálogo,
categorías, reseñas y asistencia de MercadoTech por stdio — 10 tools, 7
resources y 5 Prompts MCP — más 4 Skills de gobernanza que revisan ubicación
de archivos, calidad de código, diseño y aprobación binaria del propio
proyecto Next.js. 57 archivos, +5810 líneas (`git diff --stat 8f4fa9a..HEAD`;
`8f4fa9a` es un chore de seed de imágenes ajeno a esta sesión, hecho entre el
cierre de la sesión 4 y el inicio de esta).

> Mismo aviso que las sesiones 3 y 4: los commits de Fase 5.1 a 5.5 se
> crearon el 2026-08-31; el ciclo de revisión de gobernanza (Fase 5.6) corrió
> al día siguiente, 2026-09-01, sobre el mismo código ya commiteado.

### Prompt 0 — Provisión (commit `d326f46`)

**Construido:** `mcp/package.json`, `mcp/.gitignore` y las dependencias del
servidor (`@modelcontextprotocol/sdk`, `zod`, `@supabase/supabase-js`,
`tsup`, `tsx`) — sin tocar el `package.json` de la raíz: `mcp/` es un
proyecto Node independiente que solo comparte el `tsconfig` base y el alias
`@/*` hacia la raíz.

### Fase 5.1 — Skills de gobernanza (commit `e707ae0`)

**Construido:** 4 Skills en `.claude/skills/`: `mercadotech-architecture-enforcer`
(gate previo de ubicación de archivos), `mercadotech-code-reviewer` (informe
de PR con calificación /10), `mercadotech-tech-lead` (juicio de diseño
ponderado, scorecard) y `mercadotech-automatic-validator` (veredicto binario
APROBADA/FALLIDA sobre una checklist fija).

**Decisión — cuatro roles separados, no una sola Skill de "revisión":** cada
una responde una pregunta distinta y con una superficie de salida distinta
(gate previo vs. informe con nota vs. scorecard ponderado vs. veredicto
binario); mezclarlas habría hecho que "revisa esto" significara cosas
distintas según quién preguntara. `CLAUDE.md` queda como fuente de verdad de
las cuatro: ante una contradicción, gana `CLAUDE.md`.

### Fase 5.2 — Scaffold del servidor MCP sobre stdio (commit `18dedbd`)

**Construido:** servidor `mercadotech` vacío que arranca por stdio sin
corromper el canal JSON-RPC — 0 tools, 0 resources, 0 prompts, pero con toda
la fontanería delicada resuelta: `lib/stdout-guard.ts` (redirige
`console.log/info/warn` a stderr, importado primero en `index.ts` porque los
`import` de ESM se hoistean), `env.ts` (`loadEnvLocal` sobre la `.env.local`
de la RAÍZ, buscada hacia arriba desde el módulo porque el cliente MCP fija
un cwd arbitrario), `context.ts` (fábrica de `{anon, admin}` POR LLAMADA, no
singleton — con el stub de `WebSocket` que Node 20 no expone) y
`lib/{tool-result,errors,safe}.ts` (formato de salida, errores tipados,
wrapper try/catch uniforme).

**Decisión — `context.ts` construye sus clientes con `@supabase/supabase-js`
directamente, no con `lib/supabase/`:** los clientes de la web están
afinados para navegador/Route Handler/middleware, no para un proceso stdio
sin sesión ni cookies — mismo criterio que ya había resuelto
`scripts/index-all.ts`.

**Decisión — el alias `@/*` sigue resolviendo hacia la raíz, sin
reescribirlo:** `mcp/tsconfig.json` extiende el `tsconfig.json` de la raíz y
solo redeclara `@/*` → `../*`, así que `@/services/...` y `@/lib/ai/...`
resuelven exactamente igual que en la web. La contrapartida es operativa, no
de código: el servidor tiene que lanzarse `npx tsx mcp/src/index.ts` **desde
la raíz** (`mercadotech/`), nunca desde dentro de `mcp/` — un cwd
equivocado revienta con `Cannot find module '@/services/…'` (documentado en
la tabla de síntomas de `mcp/README.md`). El build de `tsup` (Fase 5.5) lee
ese mismo `tsconfig.json` para bundlear los archivos del alias en
`dist/index.js`, sin un segundo mapeo que se pudiera desincronizar.

### Fase 5.3 — 10 tools MCP de solo lectura (commit `95f5658`)

**Construido:** `search_products`, `get_product`, `list_categories`,
`semantic_search_products`, `ask_assistant`, `compare_products`,
`find_related_products`, `summarize_reviews`, `get_store_stats`,
`get_order_status` — un archivo por tool en `mcp/src/tools/`, registro
central en `tools/index.ts`, `defineTool` envolviendo cada handler en
`safeTool` y marcándolo `readOnlyHint`. Ninguna tool escribe.

**Decisión — cliente explícito siempre, nunca el default del service:** las
10 tools pasan `anon` o `admin` a cada llamada de `services/*`; admin solo en
las 5 que la RLS obliga (`knowledge_embeddings` concede SELECT solo a
`authenticated`; `orders`/`order_items` filtran por `auth.uid()`).

**Decisión — `get_order_status` recorta la salida a propósito:** solo
estado, fecha, total e ítems (snapshots de título y precio) — nunca
`buyer_id` ni datos personales, aunque el cliente admin los tenga delante. El
comentario en el propio archivo advierte que en producción exigiría
autenticación del comprador; la reutilizará el agente de voz de la sesión 8.

**Derivaciones documentadas en `mcp/src/shared/`** (sin agregar services
nuevos al proyecto web): `products.ts` (`getProductsByIds` —
`product.service.getProductsByIds` no existe en el repo pese a lo que afirma
la spec de la sesión; se compone `getProductById`) y `stats.ts` (conteo por
categoría y ranking de más vendidos, este último agregando `order_items` con
admin y leyendo solo tres columnas, ningún dato personal).

**Decisión — `HUGGINGFACEHUB_API_TOKEN` deja de ser obligatoria al
arrancar:** sin token, las 4 tools que dependen de IA devuelven el error
accionable de `lib/ai/` como error de tool (`provider_down`) y las otras 6
siguen funcionando con normalidad — el servidor nunca se cae por falta de un
token que solo una parte de las tools necesita.

### Fase 5.4 — Resources y Prompts MCP (commit `20fe5af`)

**Construido:** 7 resources (`mercadotech://info` estático, `products`,
`products/{id}` y `sellers/{sellerId}` como `ResourceTemplate` con callback
`list`, `categories`, `faq`, `stats`) y 5 Prompts MCP (`describir_producto`,
`comparar_productos`, `redactar_respuesta_pregunta`, `resumen_de_resenas`,
`generar_articulo_faq`), con registro central en `resources/index.ts` y
`prompts/index.ts`.

**Decisión — cada resource captura sus propios errores:** `safeResource`/
`safeValue` (ampliados en esta fase) garantizan que `resources/list` nunca
falle completo — una fuente caída degrada a su fallback en vez de tumbar el
listado entero.

**Decisión — `sellers/{sellerId}` con cliente admin, recortado a
propósito:** `profiles` no tiene SELECT público
(`profiles_select_own_or_admin`), así que con anon esta tabla es invisible
para un proceso sin sesión; el resource expone solo `display_name` +
productos activos, nunca `phone`.

**Refactor:** `compare_products` (tool) se subió a `shared/products.ts` como
`compareProducts`, para que el prompt `comparar_productos` comparta
exactamente la misma lógica y no recalcule la tabla dos veces con formas
ligeramente distintas.

### Fase 5.5 — Registro y documentación del servidor MCP (commit `320c0c2`)

**Construido:** `.mcp.json` en la raíz (declara el servidor `mercadotech`
por stdio para Claude Code), `mcp/README.md` (arquitectura, las decisiones
de la sesión, comandos, tabla completa de tools/resources/prompts × service
reutilizado × cliente). `mcp/dist/` se excluyó del `eslint` de la raíz
(build de `tsup`, no código propio) para que `npm run lint` no falle después
de `npm run build`.

**Verificado:** pasada completa por el Inspector de MCP (10 tools, 7
resources, 5 prompts, casos del seed) y build de producción
(`node mcp/dist/index.js`) sin hallar bugs — no hubo cambios en `mcp/src/`
en este commit.

### Fase 5.6 — Ciclo de revisión de gobernanza (commits `3947a4c`, `20c12f7`, `0f65f1b`)

**Construido:** primera pasada real de las 4 Skills de la Fase 5.1 sobre su
propio código — `mercadotech-tech-lead` sobre `mcp/src/` completo y sobre
`services/`+`hooks/` completos; `mercadotech-code-reviewer` sobre `lib/ai/`,
los 3 Route Handlers de `app/api/v1/` y `mcp/src/`; `mercadotech-automatic-validator`
sobre el estado final. Consolidado en `docs/REVISION_S5.md` (una fila por
hallazgo: severidad, veredicto, evidencia).

**Corregido:** los dos únicos hallazgos de `code-reviewer` (ninguno
crítico) — URIs sintéticas sin resource real detrás en los prompts
`comparar_productos`/`redactar_respuesta_pregunta` (ahora bajo
`mercadotech://ephemeral/...`, commit `3947a4c`) y el log de error de
`/api/v1/chat`, que incluía el texto completo de la consulta a diferencia
del log de éxito de la misma ruta (commit `20c12f7`).

**Diferido a propósito, no corregido hoy:** el store módulo-global de
`useCart` no limpia `items` de forma síncrona al cambiar `userId` — entre el
logout de un usuario y que resuelva el `loadItems` del siguiente, un
componente montado puede mostrar por un instante el carrito del anterior en
la misma pestaña. Bajo riesgo/beneficio (solo se manifiesta en
login→logout→login sin recargar en la misma pestaña); ver
`docs/REVISION_S5.md`.

**Confirmado en vivo:** al invocar `ask_assistant` cuatro veces con la misma
consulta ("laptop liviana para la universidad"), el modelo dio cuatro
redacciones distintas sobre las mismas 5 fuentes recuperadas (idéntica
`similitud`) — incluyendo un peso inventado ("1.4 kg") que no existe en
ninguna descripción del catálogo. No es un hallazgo nuevo: es la
manifestación directa de la deuda ya documentada en la sesión 4
(`hasRelevantContext` no confiable, sección (b) de esa sesión) vista ahora
también desde el servidor MCP.

**Veredicto final:** `VALIDACIÓN APROBADA` — los 4 greps de capas vacíos,
sin hallazgos críticos pendientes, `lint`/`type-check`/`build` en verde en
la raíz y en `mcp/`. `npm run test` sigue `N/A` (sesión 6, el script no
existe todavía).

### Desviaciones de la spec confirmadas contra el repo (gana el código)

La especificación de la sesión 5 (`MercadoTech_sesion5.md`) da por ciertos
algunos datos de ejemplo que no coinciden con el seed real. Se documentan
aquí en vez de "corregir" el seed o inventar coincidencias:

- **`product.service.getProductsByIds` no existe** (la spec lo da por hecho
  en su tabla "Estado de partida") — se derivó en `shared/products.ts`
  componiendo `getProductById` (Fase 5.3).
- **El vendedor de ejemplo real es "ElectroMax Perú"**, no "TecnoStore
  Perú" como dice el texto de verificación de la Fase 5.4 —
  `mercadotech://sellers/{id de seller1}` se probó y documentó con el
  vendedor real del seed.
- **El pedido `c0000000-…01` está `pendiente`, no `entregado`** como dice el
  texto de verificación de la Fase 5.3 — `get_order_status` se probó con
  `c0000000-…05`, que sí es el pedido `entregado` con 2 ítems del seed.

---

### (a) Criterios de aceptación de la sesión

| Criterio | Estado | Evidencia |
|---|---|---|
| Servidor MCP con 10 tools, 7 resources y 5 Prompts registrados | ✅ | Pasada por el Inspector documentada en `mcp/README.md` (Fase 5.5) |
| Ninguna tool/resource muta datos ni expone información privada de comprador | ✅ | `readOnlyHint: true` por construcción (`defineTool`); `get_order_status` y `sellers/{id}` recortados a propósito (Fase 5.3/5.4) |
| Servidor operable sin `HUGGINGFACEHUB_API_TOKEN` (degradación parcial, no caída total) | ✅ | Las 6 tools sin dependencia de IA siguen funcionando; las 4 restantes devuelven `provider_down` (Fase 5.3) |
| Los 4 greps de capas de `CLAUDE.md` vacíos | ✅ | Verificados en la Fase 5.6 sobre el estado final |
| `lint`, `type-check` y `build` pasan en la raíz y en `mcp/` | ✅ | Los cinco comandos en exit 0 (Fase 5.6, `docs/REVISION_S5.md`) |
| Las 4 Skills de gobernanza corridas al menos una vez sobre código real | ✅ | Fase 5.6: tech-lead ×2, code-reviewer ×1, automatic-validator ×1 |

### (b) Deuda técnica y limitaciones vigentes (nuevas de la sesión 5)

1. **`useCart` puede mostrar el carrito del usuario anterior por un
   instante.** El store módulo-global (`useSyncExternalStore`) no limpia
   `items` de forma síncrona al cambiar `userId`; solo se limpia cuando
   resuelve el `loadItems` del nuevo usuario. Bajo impacto: requiere
   login→logout→login en la misma pestaña sin recargar.
2. **Patrón `fetchX`/`loading`/`error`/`retry` duplicado en 7 hooks**
   (`useOrders`, `useQuestions`, `useReviews`, `useSellerOrders`,
   `useSellerProducts`, `useMyTickets`, `useFavorites`). Sostiene bien hasta
   ahora; si sesión 6 en adelante agrega varios hooks más con la misma
   forma, extraer un `useAsyncResource` genérico empezaría a pagarse solo.
3. **`get_order_status` bypasea la RLS con el cliente admin.** Cualquiera
   que adivine (o consiga) un UUID de pedido puede ver su estado — aceptable
   en este proyecto de curso con datos de semilla, y documentado en el
   propio archivo como algo que en un despliegue real exigiría el token de
   sesión del comprador.
4. **Dos de los cinco Prompts MCP embebían contenido bajo URIs sin resource
   real detrás.** Corregido en la Fase 5.6 (commit `3947a4c`) — se deja
   anotado por si aparece un tercer caso: la convención es
   `mercadotech://ephemeral/...` para contenido embebido no navegable vía
   `resources/read`.

### (c) Pendientes

**Heredados de sesiones anteriores (sin cambios en esta sesión):**

- **Sesión 1 completa:** sigue sin ejecutarse. Faltan `docs/COSTOS.md` y
  `docs/PROMPTS.md`.
- **Fase 2.6:** `supabase/tests/` sigue vacío (solo `.gitkeep`). Faltan los
  scripts de validación RLS.

**Para la sesión 6:**

- `npm run test` no existe todavía en el `package.json` de la raíz — la
  Skill `mercadotech-automatic-validator` lo marca `N/A` hasta entonces.
- El agente de voz (mencionado como consumidor futuro de `get_order_status`
  desde la Fase 5.3) es trabajo de la sesión 8, no de esta.

---

## Sesión 4 — IA integrada con RAG (2026-08-31)

**Alcance:** búsqueda semántica sobre pgvector, y dos asistentes
conversacionales (asesor de compras y soporte) que responden EXCLUSIVAMENTE
con el conocimiento indexado de la plataforma, citando sus fuentes. 55
archivos, +3701 líneas (`git diff --stat dfef469..HEAD`, `dfef469` es el
cierre de la sesión 3).

> Mismo aviso que la sesión 3: los 9 commits de esta sesión se crearon
> todos el 2026-08-31, en el orden real de las fases — pero sin la
> cronología de días que tendría una sesión ejecutada a lo largo del
> tiempo real.

### Prompt 0 — Provisión y smoke test (commit `308ecf6`)

**Construido:** verificación de que la sesión 3 estaba completa (`npm run
build` limpio), stack Supabase local, token de Hugging Face confirmado en
`.env.local`, 3 variables nuevas en `.env.example` sin valores
(`HUGGINGFACEHUB_API_TOKEN`, `HUGGINGFACE_EMBEDDING_MODEL`,
`HUGGINGFACE_CHAT_MODEL`), dependencias `@huggingface/inference` y `tsx`.

**Smoke test contra la API real, antes de escribir código:** embeddings vía
SDK devolvieron un vector de 384 dimensiones; para el chat se probaron 5
modelos candidatos contra el router — solo `meta-llama/Llama-3.1-8B-Instruct`
(el de la spec) respondió; `Qwen2.5-7B-Instruct`, `Llama-3.2-3B-Instruct` y
`SmolLM3-3B` dieron "not supported by any provider", `Mistral-7B-Instruct-v0.3`
dio "is not a chat model". **El modelo NO rotó** — se pudo seguir con el
elegido por la spec, sin buscar reemplazo.

### Fase 4.1 — Infraestructura vectorial (commit `94cd36c`)

**Construido:** 4 migraciones nuevas (`enable_pgvector`,
`create_knowledge_embeddings`, `create_match_knowledge`,
`knowledge_embeddings_rls`), tabla `knowledge_embeddings` con índice HNSW,
RPC `match_knowledge`, `types/database.ts` regenerado.

**Decisión — una tabla discriminada por `source_type`, no dos gemelas:**
productos y artículos tienen la misma forma (texto + vector + metadata) y
se consultan juntos; `match_knowledge` con `p_source_type` null busca en
ambas fuentes de una sola pasada del índice. Agregar una fuente futura
(reseñas, por ejemplo) es un valor más en el `check`, no una tabla nueva.

**Decisión — `source_id` sin foreign key:** apunta a dos tablas origen
distintas (`products` o `support_articles`) según `source_type`, y Postgres
no admite una FK condicional. Consecuencia asumida: al borrar una fuente
queda una ficha huérfana — la limpia el reindexado (Fase 4.3) o
`index-all`, nunca de forma inmediata.

**Decisión — RPC `SECURITY INVOKER`, no `DEFINER`:** al revés que
`create_order_from_cart` (que debía saltarse la RLS para escribir
`orders`), `match_knowledge` solo lee y necesita respetar la visibilidad
del caller — con `DEFINER` sería un agujero que sortea la política de la
decisión 1 (la IA exige sesión) para cualquiera que invoque la función.

**Verificado:** `match_knowledge` con un vector de 384 ceros → 0 filas sin
error; con fichas de prueba reales, ordenó por similitud, el threshold
filtró correctamente y `p_source_type` discriminó por fuente. Privilegios
confirmados contra la base real: `anon` sin ningún acceso, `authenticated`
solo `SELECT`.

### Fase 4.2 — Capa de IA y servicio de embeddings (commit `b23d3c7`)

**Construido:** `lib/constants/ai.ts` (14 tunables, cada uno con su
porqué), `lib/ai/{embeddings,completion,prompts}.ts`,
`services/embedding.service.ts`.

**Decisión — SDK para embeddings, `fetch` para chat:** el router
OpenAI-compatible de Hugging Face no implementa la tarea
`feature-extraction`; un `fetch` directo para vectorizar falla. Para chat
el router SÍ es el camino soportado y su contrato es un JSON trivial, así
que un SDK ahí sería una dependencia innecesaria.

**Decisión — modelo de chat por variable de entorno:** el nivel gratuito de
Hugging Face retira modelos sin aviso (confirmado en el Prompt 0, aunque no
pasó esta vez); `HUGGINGFACE_CHAT_MODEL` permite cambiar de modelo sin
tocar código.

**Verificado con script de humo real** (scratchpad, no en el repo):
embedding de 384 dimensiones; completion citando con `[1]` cuando el
contexto sí tenía coincidencia, y negándose a inventar cuando no la tenía;
mensajes de error diferenciados (401 / modelo no disponible / respuesta
inválida) al quitar el token, restaurado después.

### Fase 4.3 — Indexación automática (commit `1f71b1d`)

**Construido:** `lib/api-response.ts`, `app/api/v1/reindex/route.ts`
(primer Route Handler del proyecto), `services/indexing-trigger.service.ts`
(fire-and-forget), `scripts/index-all.ts`; `useProductForm` y
`useSellerProducts` ampliados para disparar el reindexado.

**Problema:** Node 20 no expone `WebSocket` global (llegó recién en Node
22) y `supabase-js` lanza al construir el cliente admin aunque el script
solo use REST. Se resolvió con un stub de `WebSocket` dentro de
`scripts/index-all.ts` en vez de exigir Node 22 o sumar la dependencia
`ws`.

**Verificado:** `index-all` → 14 productos + 10 artículos = 24 fichas;
publicar por la UI → fila 25; editar el título → sigue en 25 (upsert, no
duplicado) con el `content` actualizado; publicar con el token renombrado →
la publicación se completa igual, con solo un `console.warn` en el
servidor — el vendedor no se entera.

### Fase 4.4 — Búsqueda semántica en el catálogo (commit `b178f77`)

**Construido:** `services/vector-search.service.ts`,
`app/api/v1/search/semantic/route.ts`, `hooks/useSemanticSearch.ts`,
pestaña "Resultados con IA" en `/buscar`, badge de similitud opcional en
`ProductCard`/`ProductGrid`.

**Decisión — la IA exige sesión (decisión 1 de la spec):** la RLS de
`knowledge_embeddings` ya solo deja leer a `authenticated`; la pestaña IA
muestra el aviso de login a los anónimos en vez de una pestaña
silenciosamente vacía, y de paso protege la cuota gratuita del proveedor.

**Problema encontrado y corregido:** `useAuth` importaba
`@/lib/supabase` directamente (violación de capas, detectable con el grep
de la sesión 3). Se movió `onAuthStateChange` a `auth.service.ts`.

**Problema de entorno (no de código):** el panel del navegador de pruebas
corre oculto por defecto, lo que colapsa los `rect` de layout a `0×0` y
rompe el clic sobre los `Tabs` de base-ui (dependen de geometría real).
Forzar una captura de pantalla antes de cada clic pinta el panel y lo
resuelve.

**Hallazgo honesto, sin maquillar:** con la consulta *"audífonos **para
el** gimnasio"* (con el artículo "el"), el producto de audio **no** quedó
primero — una silla gamer ganó (0.4195 vs 0.3950). Con la redacción exacta
de la Fase 4.8 ("audífonos para gimnasio", sin "el") sí funciona. Quedó
documentado como una sensibilidad real del modelo a la redacción, no
oculto.

### Fase 4.5 — Constructor de contexto (commit `038dc0b`)

**Construido:** `lib/ai/context-builder.ts` — función pura, cero I/O.

**Verificado en frío** (sin red, con datos en memoria): lista vacía y
"todas bajo el threshold" dan `contextTruncated: false` (se filtró por
relevancia, no por presupuesto — dos señales distintas, adrede no
confundidas); una fuente gigante se recorta a 8000 caracteres en vez de
descartarse; una fuente a la que le quedan menos de 200 caracteres de
presupuesto se descarta ENTERA en vez de cortarse a media frase; empates de
similitud conservan el orden de entrada. Pureza confirmada de forma
transitiva: sus dos únicos imports (`lib/ai/prompts`, `lib/constants/ai`)
no tienen dependencias propias.

### Fase 4.6 — Servicio conversacional y endpoint (commit `809bd3b`)

**Construido:** `types/chat.ts`, `services/chat.service.ts` (`ask`),
`app/api/v1/chat/route.ts`; se agregó `vector-search.service.searchByQuery`
(pieza que faltaba para que `chat.service` no tuviera que generar el
embedding él mismo, lo que lo habría obligado a conocer al proveedor).

**Decisión:** `MODE_CONFIG` es el único lugar de todo el proyecto que sabe
que existen los modos `compras`/`soporte` — cada modo es solo dos datos
(`sourceType` + instrucciones de sistema). `chat.service` no importa
`@huggingface/*`, no arma prompts a mano, no consulta la tabla ni recorta
contexto: encadena `vector-search` → `context-builder` → `completion`.

**Primera señal del problema que resuelve la Fase 4.8:** la consulta
`¿venden autos usados?` devolvió `hasRelevantContext: true` (se esperaba
`false`) — las 5 fichas recuperadas, todas irrelevantes, superaban el
umbral de 0.3 igual.

### Fase 4.7 — Interfaz del asistente (commit `8f78d70`)

**Construido:** `hooks/useChat.ts`, `hooks/useMyTickets.ts`,
`services/ticket.service.ts`, `components/chat/*` (puros),
`TicketStatusBadge`/`TicketCard`, páginas `/asistente` y `/soporte`,
`UserMenu`/`MobileNav`/middleware ampliados con las dos rutas nuevas.

**Decisión 5 de la spec:** `ticket.service` solo tiene `listMine` —
crear tickets desde la UI llega con el agente de la sesión 8.

**Desviación de la spec, verificada contra el seed real:** la spec pedía
comprobar que "`buyer1` ve sus tickets del seed", pero los 2 tickets del
seed están asignados a `buyer2` y `buyer3` — `buyer1` no tiene ninguno. Se
verificaron las 3 cuentas: `buyer1` ve el `EmptyState` correcto (no tiene
tickets), `buyer2` ve "Mi pedido no ha llegado" (En proceso), `buyer3` ve
su ticket resuelto.

**Verificado:** clic en una fuente de producto abrió el producto correcto;
con el servidor levantado sin token, el chat mostró
*"No pude procesar tu consulta, intenta de nuevo."* como un mensaje más de
la conversación — nunca una pantalla de error — y el resto de la app
funcionó normal.

### Fase 4.8 — Calibración, observabilidad y casos de prueba (commit `a6f0d69`)

**Construido:** `docs/RAG.md` con los 6 casos, sus transcripciones reales y
la calibración.

**¿Hubo calibración?** Sí, con datos: 8 consultas reales (las de los casos
+ 2 legítimas extra + 2 absurdas) mostraron que `hasRelevantContext` fue
`true` en las 8 — incluidas las 3 absurdas — porque el umbral de 0.3 nunca
filtra nada en este catálogo. Se comprobó matemáticamente que subir el
umbral no arregla nada: el mejor resultado real de una consulta legítima
("audífonos para gimnasio", 0.3798) puntúa **más bajo** que el peor
resultado de ruido de una consulta irrelevante ("autos usados", 0.4058).
Ningún valor de threshold separa limpiamente ambos casos.

**Decisión: el umbral se queda en 0.3.** No porque sea el ideal, sino
porque moverlo cambia qué caso falla, no si alguno falla — es un límite de
`all-MiniLM-L6-v2` (modelo chico, español débil) sobre un catálogo
temáticamente homogéneo, no un problema de calibración. Se actualizaron los
comentarios de `VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD` y
`CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY` en `lib/constants/ai.ts`; el valor
numérico no cambió.

**Resultado real de los 6 casos** (no lo que se esperaba que pasara):

| Caso | Estado |
|---|---|
| 1. Indexación automática | ✅ |
| 2. Recuperación semántica | ✅ (con la redacción exacta del caso) |
| 3. Respuesta contextual (compras) | ⚠️ cumple "2+ fuentes" en 1 de 2 intentos — no determinismo del modelo |
| 4. Respuesta contextual (soporte) | ✅ |
| 5. Sin información | ❌ el modelo no admite la falta de info; respuesta engañosa, causa diagnosticada |
| 6. Navegación desde fuentes | ✅ (artículo ancla a `/soporte`, limitación ya conocida) |

**Fuera de alcance en toda la sesión** (a propósito, no por omisión):
streaming de las respuestas, crear tickets desde la UI (sesión 8), el
agente de voz (sesión 8), persistir el historial de la conversación,
re-decidir proveedor/modelo/dimensión (Guía HF, decisiones cerradas).

---

### (a) Criterios de aceptación de la sesión

| Criterio | Estado | Evidencia |
|---|---|---|
| Los 6 casos de prueba documentados en `docs/RAG.md` | ✅ | Los 6 con transcripción real; 4 pasan, 1 con reserva, 1 falla documentado |
| Sin token, el resto de la app funciona y la IA da error controlado | ✅ | Catálogo con 12 productos cargados sin token; chat con mensaje inline amable |
| Anónimo: catálogo y búsqueda exacta intactos; IA pide sesión | ✅ | `/asistente` anónimo → `/login?redirectTo=/asistente`; pestaña IA con aviso; exacta sin cambios |
| `grep` de `@huggingface` fuera de `lib/ai/` vacío | ✅ | Verificado en cada fase |
| `grep` de `lib/supabase/admin` fuera de `app/api/v1/` y `scripts/` vacío | ✅ | Admin solo en los 2 lugares permitidos |
| `lint`, `type-check` y `build` pasan | ✅ | Los tres en verde en cada fase; build final con 20 rutas |

### (b) Deuda técnica y limitaciones vigentes (nuevas de la sesión 4)

1. **Caso 5 falla tal como está escrito.** "¿venden autos usados?" no
   admite la falta de información — confunde "autos usados" con la
   condición "usado" de los productos. Diagnosticado en `docs/RAG.md`: no
   se resuelve moviendo el threshold, requeriría un modelo de embeddings
   más grande/multilingüe, re-ranking, o búsqueda híbrida — los tres fuera
   de alcance (modelo cerrado por la Guía HF).
2. **`hasRelevantContext` no es una señal confiable de relevancia real.**
   Puede ser `true` con contexto completamente irrelevante (3 de 8
   consultas de calibración). El síntoma correcto a mirar es la respuesta,
   no ese booleano solo.
3. **El caso 3 es no determinista.** La misma consulta a veces cita 1
   producto, a veces 2+, porque un accesorio (mochila) puntúa más alto que
   los productos realmente pedidos (laptops).
4. **Los artículos de FAQ no tienen página propia.** `SourcesList` ancla
   las fuentes de tipo `articulo_soporte` de vuelta a `/soporte`, no a un
   detalle del artículo — documentado desde la Fase 4.7.
5. **Las mini-cards de producto en el chat no tienen imagen real.**
   `ChatSource.metadata` (lo que se guarda al fichar) no incluye
   `image_url`; `SourcesList` usa el mismo placeholder que el resto de la
   app.
6. **La conversación no persiste.** Vive en memoria del navegador; se
   pierde al recargar — a propósito, fuera de alcance de esta sesión.
7. **Sin streaming.** Las respuestas llegan completas, no token a token —
   a propósito, fuera de alcance.

### (c) Pendientes

**Heredados de sesiones anteriores (sin cambios en esta sesión):**

- **Sesión 1 completa:** sigue sin ejecutarse. Faltan `docs/COSTOS.md` y
  `docs/PROMPTS.md`.
- **Fase 2.6:** `supabase/tests/` sigue vacío (solo `.gitkeep`). Faltan los
  scripts de validación RLS.
- **Fase 2.7:** sigue sin estar pendiente — `docs/ARQUITECTURA.md` existe.

**Generados en esta sesión, para cuando se retome este flujo:**

- Calibrar el retrieval con un modelo de embeddings mejor o con
  re-ranking, si el caso 5 (o similares) se vuelve un problema real de
  producto y no solo de laboratorio.
- Crear tickets desde la UI y el agente de voz (sesión 8, ya anticipado en
  el layout de `/soporte`).
- Página propia por artículo de FAQ, si se necesita navegación más
  profunda desde las fuentes citadas.

---

## Sesión 3 — UI inteligente y frontend multimodal (2026-08-30 / 2026-08-31)

**Alcance:** MVP funcional completo del marketplace sobre la infraestructura
de la sesión 2. 129 archivos, +8829 líneas (`git diff --stat cece039..HEAD`).

### Prompt 0 — Provisión del entorno (commit `31385d3`)

**Construido:** stack Supabase local levantado, `.env.local` generado desde
`supabase status -o env`, dependencias (`lucide-react`, `@dnd-kit/*`), los 16
componentes de `components/ui/` (shadcn) y los scripts `db:types` y
`type-check` en `package.json`.

**Decisión:** se agregó `type-check` además de `db:types`, porque las fases
siguientes lo exigen y no existía — sin él, `npm run type-check` fallaba por
script inexistente, no por errores de tipos.

**Problema:** `npm install -g supabase` falló con `ENOENT` en
`C:\Users\MK\AppData\Roaming\npm` (el directorio de prefijo global de npm no
existía). Se creó y la instalación funcionó.

**Fuera de alcance:** `docs/COSTOS.md` y `docs/PROMPTS.md` (sesión 1, nunca
ejecutada).

### Fase 3.1 — Tipos, sistema visual y componentes base (commit `5bc9033`)

**Construido:** `types/database.ts` generado con `npm run db:types`, tipos de
dominio (`product.ts`, `order.ts`, `user.ts`, `question.ts`, `review.ts`),
tokens de tema con primario azul eléctrico en `app/globals.css`,
`formatPrice` en `lib/utils.ts`, `images.remotePatterns` en `next.config.ts`,
y los 8 componentes de `components/shared/`.

**Decisión:** se agregaron tokens semánticos propios (`--success`,
`--warning`, `--info`) además de los de shadcn, para que `ConditionBadge` y
`OrderStatusBadge` no hardcodeen colores.

**Problema:** este `components.json` usa el estilo `base-nova` de shadcn,
montado sobre `@base-ui/react` y **no sobre Radix**. Los triggers no aceptan
`asChild` sino `render={<Button />}`. Se detectó con `tsc` y se corrigió en
las 3 instancias de `/dev/ui`.

**Fuera de alcance:** componentes de dominio (llegan en cada fase).

### Fase 3.2 — Layouts, navegación y mapa de rutas (commit `e5cd363`)

**Construido:** layout raíz real (`lang="es"`, metadata, `<Toaster />`), los
3 layouts de grupo, los 8 componentes de `components/layout/` (puros) y las
14 rutas del mapa como placeholders.

**Decisión:** el panel del vendedor vive bajo `/vendedor/...` para que
`/pedidos` (comprador) y `/vendedor/pedidos` no colisionen; se eliminó
`app/page.tsx` porque chocaba con `app/(shop)/page.tsx` (ambas resuelven `/`).

**Problema 1:** el build falló con *"Event handlers cannot be passed to
Client Component props"* — el layout (Server Component) pasaba `onSearch={()
=> {}}` a `SearchBar` (cliente). Se resolvió haciendo `onSearch` opcional con
el no-op **dentro** del componente cliente.

**Problema 2:** base-ui avisaba que `Button render={<Link/>}` rompe la
semántica nativa de botón. Se cambió al patrón estándar de shadcn:
`<Link className={buttonVariants({...})}>`.

**Fuera de alcance:** conectar los componentes del navbar a datos reales
(cada fase posterior conecta el suyo); ruta `/soporte` (sesión 4).

### Fase 3.3 — Autenticación (commit `e3015e9`)

**Construido:** migración `20260831100000_handle_new_user_metadata.sql`,
`lib/validators/auth.ts`, `services/auth.service.ts`, `hooks/useAuth.ts`,
`components/auth/`, pantallas `/login` y `/register`, y el middleware
ampliado con protección de rutas.

**Decisión:** el rol se fija en el INSERT del trigger de alta leyendo
`raw_user_meta_data`, porque `protect_profile_role` (Fase 2.3) es
`BEFORE UPDATE` e impide cambiarlo después. Es el **único** momento del ciclo
de vida en que puede establecerse. La allow-list acepta solo `buyer`/`seller`:
cualquier otro valor (incluido `admin` manipulado desde DevTools) cae a
`buyer`.

**Decisión 2:** los layouts son Server Components y no pueden usar hooks, y
la regla de capas prohíbe que `components/` importe `hooks/`. Se crearon
conectores **colocados en `app/`** (`ShopNavbar.tsx`, `SellerGuard.tsx`), un
patrón que se repite en todas las fases siguientes.

**Problema:** el middleware protegía correctamente, pero faltaba cubrir el
caso "hay sesión pero el rol no alcanza" — lo cubre `SellerGuard`, que
además muestra `LoadingState` mientras `initializing` es true para no
parpadear.

**Fuera de alcance:** confirmación de email (en local
`enable_confirmations = false`), recuperación de contraseña.

### Fase 3.4 — Catálogo (commit `8517742`)

**Construido:** `lib/constants/catalog.ts`, `storage.service.ts` (solo
`getPublicUrl`), `category.service.ts`, `product.service.ts`,
`useCategories`, `useProducts`, los 4 componentes de `components/catalog/`, y
las 3 páginas del catálogo compartiendo el mismo grid y hook vía
`CatalogView`.

**Decisión:** los filtros viven en la URL (`useSearchParams`) como única
fuente de verdad, así el estado es compartible y recargable. Cambiar un
filtro vuelve a página 1.

**Decisión 2:** `is_active = true` se filtra **explícitamente** aunque la RLS
ya lo garantiza para anónimos — sin ese filtro, un vendedor logueado vería
sus propios productos inactivos en la home.

**Problema:** el filtro `.or()` de PostgREST separa condiciones por comas, así
que un término de búsqueda con coma o paréntesis rompía el parseo. Se
sanitizan antes de interpolar.

**Fuera de alcance:** búsqueda semántica (sesión 4); la búsqueda por texto es
`ilike` sobre `title` y `brand`, marcada como provisional en el código.

### Fase 3.5 — Detalle, Q&A, reseñas y favoritos (commit `45b8394`)

**Construido:** `registerView` en `product.service`, los services
`question`/`review`/`favorite`, 5 hooks, los 5 componentes de
`components/product/`, y las páginas `/producto/[id]` y `/favoritos`.

**Decisión:** la UI solo ofrece acciones que la RLS va a permitir
("defensa en profundidad"): `canReview` replica exactamente la condición de
`reviews_insert_verified_purchase` (pedido propio `entregado` con ese
producto, y sin reseña previa), y el input de respuesta solo aparece si
`profile.id === product.seller_id`.

**Desviación de la spec:** la spec cita un trigger
`lock_question_immutable_fields` que **no existe** en el repo (verificado con
grep). Lo que restringe es la política `questions_update_seller_answers`, que
limita *quién* actualiza pero no *qué columnas*. El service se disciplina
enviando solo `{answer, answered_at}`.

**Fuera de alcance:** vista `public_profiles` — por eso las preguntas
muestran "Usuario" y las reseñas "Comprador verificado".

### Fase 3.6 — Carrito, checkout y pedidos (commit `6b070dc`)

**Construido:** `lib/constants/orders.ts`, `cart.service.ts`,
`order.service.ts`, `useCart`, `useOrders`, `components/cart/`,
`components/orders/`, y las páginas `/carrito`, `/pedidos`, `/pedidos/[id]`.

**Decisión:** `useCart` usa un store a nivel de módulo con
`useSyncExternalStore`. Se monta simultáneamente en tres lugares (navbar,
detalle de producto y `/carrito`); con `useState` local, el contador del
navbar quedaba desactualizado al agregar desde el detalle.

**Decisión 2:** el checkout llama **siempre** al RPC
`create_order_from_cart`, nunca a un insert directo: `orders` no tiene
política ni GRANT de INSERT, así que un insert del cliente falla con
"permission denied".

**Problema:** ninguno funcional. Se verificó el rollback del RPC con stock
insuficiente: el toast mostró el mensaje exacto de Postgres nombrando el
producto, el carrito quedó intacto y no se creó ningún pedido.

**Desviación de la spec:** el trigger `lock_order_immutable_fields` que cita
la spec **no existe**; quien restringe la cancelación es la política
`orders_update_buyer_cancel_pending`. Además, el producto con stock 0 es
`b…05`, no `b…06`.

**Fuera de alcance:** pasarela de pago real (el checkout es simulado y la UI
lo dice), reposición de stock al cancelar, realtime.

### Fase 3.7 — Panel del vendedor con drag & drop (commit `c845e5a`)

**Construido:** `lib/constants/product.ts`, `lib/validators/product.ts`,
`seller.service.ts`, `storage.service` ampliado (upload/delete/saveImageOrder/
addProductImage), 3 hooks y los 5 componentes de `components/seller/` con los
dos drag & drop.

**Decisión (galería):** en modo **create** las imágenes viven solo en memoria
(`File[]` + `createObjectURL`) porque el path de Storage exige `product_id`,
que aún no existe; al enviar se crea el producto, se suben en el orden final
y se insertan con `position = índice`. En modo **edit** cada acción persiste
al instante.

**Decisión (kanban):** la RLS permite poner `pagado`/`enviado`/`entregado`
pero **no valida la secuencia** (aceptaría `entregado → pagado`). El hook
rechaza toda transición que no sea un paso adelante en `ORDER_STATUS_FLOW`,
sin llamar al service. `cancelado` queda bloqueado por doble barrera: el hook
(no está en el FLOW) y la RLS (`42501`).

**Desviación importante de la spec (decisión 10):** la spec asume que
`order_items.product_id` es `ON DELETE RESTRICT` y que basta con capturar el
error `23503`. En el esquema **real** es `ON DELETE SET NULL`
(`confdeltype='n'`, verificado en la BD), así que ese catch sería **código
muerto**: el borrado tendría éxito y arrastraría en cascada
`product_images`, `questions`, `reviews`, `favorites` y `product_views`. Se
implementó un **guard a nivel de aplicación** que consulta `order_items`
antes de borrar; el catch de `23503` quedó como respaldo por si la FK se
endurece.

**Corrección de capas propia:** el tipo `SellerOrder` vivía en `services/` y
lo importaban los componentes; se movió a `types/order.ts`.

**Fuera de alcance:** cancelar desde el panel del vendedor (la RLS no lo
permite: la columna "Cancelado" es de solo lectura).

### Fase 3.8 — Responsive, accesibilidad y estados (commit `eb98892`)

**Construido:** `docs/SESION3_CHECKLIST.md`, `app/ThemeProvider.tsx`, y las
correcciones de la pasada de calidad. Se borró `app/dev/ui/page.tsx`.

**Problemas encontrados y corregidos:**

| Hallazgo | Corrección |
|---|---|
| `useAuth` importaba el cliente de Supabase (violación de capas; el grep de la spec lo detectaba) | Se movió `onAuthStateChange` a `auth.service.ts` |
| `useProductForm` cargaba sin `.catch()`: un fallo de red dejaba una promesa rechazada y el formulario en blanco | `loadError` + `retry` + `ErrorState` |
| **El tema oscuro era inalcanzable**: los tokens `.dark` existían pero nada añadía esa clase; con el SO en oscuro la app salía en claro | Se conectó `next-themes` (ya instalado); de paso arregla el `<Toaster />`, que llamaba a `useTheme()` sin provider |
| 4 `EmptyState` sin acción sugerida | "Limpiar filtros", "Ver catálogo", "Ver mis pedidos", "Publicar producto" |
| Los anuncios aria de la galería decían el **uuid** de la imagen | Ahora dicen la posición ("Imagen 2 de 3") |
| El kanban movía por píxeles con las flechas y no caía en una columna | `coordinateGetter` propio que salta de columna |
| El radio de rol de `RegisterForm` es `sr-only`: el foco de teclado era **invisible** | Foco proyectado sobre la tarjeta con `has-[:focus-visible]` |

**Fuera de alcance:** ninguna funcionalidad nueva (era una pasada de calidad).

---

### (a) Criterios de aceptación de la sesión

| Criterio | Estado | Evidencia |
|---|---|---|
| Flujo comprador completo | ✅ | Verificado por fases: registro con rol, login del seed, filtros en URL, detalle, carrito, checkout (stock 30→28, carrito vacío), pedido, cancelación |
| Flujo vendedor completo | ✅ | Publicar con imágenes (paths `{seller_id}/{product_id}/{n}.png`, `position` 0/1/2), producto en catálogo, kanban con transición válida persistida vía RLS |
| Reseña solo tras pedido `entregado` | ✅ | `buyer1` en `b…06` no ve el formulario (ya reseñó); tras marcar `c…03` entregado, `buyer2` sí lo ve en `b…11` y la reseña quedó con `order_id` correcto |
| Transiciones inválidas rechazadas en el hook | ✅ | Toast + **0 llamadas PATCH** a la red (se instrumentó `fetch`) |
| `lint`, `type-check` y `build` pasan | ✅ | Los tres en exit 0; build con 15 rutas |
| `grep -rl "@/lib/supabase" components hooks` vacío | ✅ | Vacío tras mover `onAuthStateChange` al service |

### (b) Deuda técnica y limitaciones vigentes

1. **Nombres de otros usuarios no legibles.** `profiles_select_own_or_admin`
   solo deja ver el profile propio, así que preguntas muestran "Usuario" y
   reseñas "Comprador verificado". Requeriría una vista `public_profiles`.
2. **Cancelar un pedido NO repone stock.** No hay trigger que lo haga. La UI
   lo advierte en el diálogo de confirmación.
3. **Pedidos multi-vendedor comparten `orders.status`.** Cada vendedor ve
   solo sus ítems y su `myTotal`, pero mover la tarjeta cambia el estado del
   pedido **completo**, incluido lo del otro vendedor.
4. **Sin realtime.** El comprador ve los cambios de estado al recargar.
5. **Imágenes del seed inexistentes en Storage.** Los `image_path` del seed
   apuntan a archivos que nadie subió; `ProductImage` muestra placeholder.
6. **`order_items.product_id` es `SET NULL`, no `RESTRICT`.** El borrado de
   productos con ventas se bloquea solo por el guard de aplicación en
   `seller.service.deleteProduct`. Si alguien borra por SQL directo, se
   pierden reseñas y preguntas en cascada. Endurecer la FK requeriría
   migración.
7. **Arrastre con puntero no verificado de punta a punta.** El panel del
   navegador corre oculto y los rects quedan degenerados
   (`clientWidth: 0`), así que dnd-kit no resuelve destino de drop. La lógica
   subyacente sí está verificada; falta una prueba manual con mouse.
8. **El historial de git no replica la cronología real** (ver nota inicial).

### (c) Pendientes

**Heredados de sesiones anteriores:**

- **Sesión 1 completa:** no se ejecutó. Faltan `docs/COSTOS.md` y
  `docs/PROMPTS.md` (estrategia de modelos/costos, biblioteca de prompts,
  test A/B). No bloquea nada del código.
- **Fase 2.6:** `supabase/tests/` sigue **vacío** (solo `.gitkeep`). Faltan
  los scripts de validación RLS con los 9 escenarios de la spec.
- **Fase 2.7:** ✅ **ya no está pendiente** — `docs/ARQUITECTURA.md` existe
  (commit `cece039`).

**Para la sesión 4:**

- pgvector + embeddings de `support_articles` (los 10 artículos del seed ya
  tienen contenido real, pensados como base del RAG).
- Búsqueda semántica: reemplaza el `ilike` provisional de
  `product.service.listActiveProducts`.
- Asistente de compras y soporte por texto; ruta `/soporte` (todavía no
  existe y por eso no está en el menú).
- Variables de entorno de IA en `.env.example` (hoy solo tiene las de
  Supabase, con nota de que las de IA llegan en la sesión 4).

---

## Sesión 2 — Arquitectura y backend con Supabase

> *Sección reconstruida a partir de los commits del repositorio.*

| Fase | Commit | Qué dejó |
|---|---|---|
| 2.1 | `3e04644` | Proyecto Next.js 15 + TypeScript estricto + Tailwind v4, shadcn inicializado, los 4 clientes de `lib/supabase/`, `.env.example`, `lib/constants/roles.ts` |
| 2.2 | `a695bf7` | 17 migraciones: extensiones, 14 tablas con RLS habilitado, trigger `handle_new_user`, RPC transaccional `create_order_from_cart`, 14 índices; `schema.sql` de referencia |
| 2.3 | `26016dd` | Políticas RLS de las 14 tablas + GRANTs de la Data API, helper `is_admin()`, trigger `protect_profile_role`; `policies.sql` de referencia |
| 2.4 | `b042a5f` | Buckets `product-images` y `avatars` (públicos de lectura, 5 MB, jpeg/png/webp) con políticas por carpeta de propietario |
| 2.5 | `aaa792c` | `seed.sql`: 6 usuarios, 8 categorías, 16 productos, 32 imágenes, 7 pedidos en los 5 estados, 8 preguntas, 4 reseñas, 10 artículos de FAQ |
| 2.6 | — | **No ejecutada.** `supabase/tests/` vacío |
| 2.7 | `cece039` | `docs/ARQUITECTURA.md` |

Hallazgos técnicos de esa sesión que siguen vigentes en el código: el
`REVOKE` previo a los GRANT en `public` (Supabase concede `ALL` por defecto
vía `ALTER DEFAULT PRIVILEGES`), el uso de `SECURITY DEFINER` en `is_admin()`
y `order_has_own_item()` para romper recursión de RLS, y que ese mismo
`REVOKE` **no funciona** en el schema `storage` (las tablas son de
`supabase_storage_admin`, no de `postgres`).

---

## Sesión 1 — Fundamentos, setup y estrategia de costos

> *Sección reconstruida: **no hay commits** de esta sesión.*

**No se ejecutó.** El repositorio se inicializó al comienzo de la sesión 2.
No existen `docs/COSTOS.md` ni `docs/PROMPTS.md`, ni el test A/B de modelos.
Ninguna fase posterior depende de estos entregables.
