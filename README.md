# MercadoTech — Plan maestro del proyecto

Plataforma de compra/venta de **productos tecnológicos** tipo Mercado Libre, con un
**centro de soporte operado por agentes de voz**. Este directorio contiene la
planeación completa del proyecto, alineada 1:1 con las 8 sesiones del curso
**Claude Code for Developers**, siguiendo el mismo patrón de especificaciones que
se usó en ReadHub (`ReadHub.md`, `ReadHub_sesion3.md`, `ReadHub_sesion4.md`).

## Cómo usar estos archivos

1. Cada sesión tiene su propio archivo `MercadoTech_sesionN.md`.
2. Cada archivo está dividido en **FASES numeradas** (ej. Fase 2.3).
3. Cada fase incluye un **Prompt sugerido**: el texto exacto para pedirle a Claude
   Code que ejecute esa fase. Se ejecutan **en orden**, una fase por prompt.
4. Antes de la primera fase de cada sesión, el primer prompt siempre es:
   > "Lee `mercadotech/MercadoTech_sesionN.md` completo y confírmame que entiendes
   > el alcance. No generes código todavía."
5. Cada sesión tiene una sección de **Restricciones** (lo que NO se debe hacer en
   esa sesión) y **Criterios de aceptación** (cómo saber que la sesión está completa).

## Mapa curso → sesión → entregable

| Sesión | Tema del curso | Archivo | Entregable principal |
|---|---|---|---|
| 1 | Fundamentos, Setup y Estrategia de Costos | `MercadoTech_sesion1.md` | Repo + CLAUDE.md + estrategia de modelos/costos + biblioteca de prompts + test A/B |
| 2 | Arquitectura Escalable y Backend con Supabase | `MercadoTech_sesion2.md` | Proyecto Next.js 15 + esquema SQL + migraciones + RLS + Storage + seed + validación RLS |
| 3 | UI Inteligente y Frontend Multimodal | `MercadoTech_sesion3.md` | Todas las pantallas + hooks + services + drag & drop (galería y kanban de pedidos) |
| 4 | Integrando IA en tu SaaS con RAG | `MercadoTech_sesion4.md` | pgvector + embeddings + búsqueda semántica + asistente de compras y soporte (texto) |
| 5 | Custom Skills y Protocolo MCP | `MercadoTech_sesion5.md` | 4 Skills de gobernanza + servidor MCP (Tools/Resources/Prompts) |
| 6 | Testing, Debugging y Automatización | `MercadoTech_sesion6.md` | Vitest (unit) + Playwright (E2E comprador y vendedor) + metodología de debugging |
| 7 | Despliegue y CI/CD con IA | `MercadoTech_sesion7.md` | GitHub Actions + performance/Core Web Vitals + deploy a Vercel + documentación |
| 8 | Demo Final y Roadmap | `MercadoTech_sesion8.md` | **Agente de voz de soporte** (STT/TTS + orquestador con herramientas) + demo + roadmap |

## Stack global (decidido desde el inicio)

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **TailwindCSS v4** + **shadcn/ui**
- **Supabase**: Postgres, Auth, Storage, pgvector, RLS
- **IA (nivel gratuito de Hugging Face)**: `sentence-transformers/all-MiniLM-L6-v2`
  (embeddings, 384 dims) + `meta-llama/Llama-3.1-8B-Instruct` (chat) — con capa de
  abstracción para cambiar de proveedor sin tocar el resto del código
- **Voz**: Web Speech API del navegador (STT `SpeechRecognition` + TTS
  `speechSynthesis`) detrás de una interfaz `VoiceProvider` intercambiable
- **MCP**: `@modelcontextprotocol/sdk` sobre stdio
- **Testing**: Vitest + Playwright · **CI/CD**: GitHub Actions + Vercel

## Principio rector: independencia de funciones, módulos y componentes

Toda decisión de las 8 sesiones respeta esta separación por capas. Es la regla
número uno del proyecto y las Skills de la sesión 5 la hacen cumplir:

```
components/       Presentación PURA. Reciben props, no hacen fetching, no conocen Supabase.
hooks/            Estado de cliente. Llaman a services. Cero lógica de negocio propia.
services/         Lógica de negocio. Cada función acepta un SupabaseClient INYECTABLE
                  (default: cliente de navegador) — así hooks y Route Handlers comparten
                  la misma lógica, y los tests la mockean sin red.
lib/supabase/     Clientes: browser (anon), server (cookies+RLS), admin (service role).
lib/ai/           ÚNICOS archivos que conocen la API del proveedor de IA.
lib/voice/        ÚNICOS archivos que conocen la API de voz del navegador/proveedor.
lib/validators/   Validación framework-agnóstica, compartida entre UI y servidor.
lib/constants/    Todos los tunables (IA, roles, límites) centralizados y documentados.
types/            Tipos de dominio + database.ts generado por Supabase.
app/api/v1/       Route Handlers DELGADOS, solo para lo que no puede correr en el
                  navegador (secretos de IA, service role, cookies de sesión).
```

Reglas derivadas (aplican en todas las sesiones):

1. **Un archivo, una responsabilidad.** `product.service.ts` no sabe de pedidos;
   `order.service.ts` no sabe de embeddings.
2. **Sin barrels.** Se importa el archivo específico, nunca "todo el módulo".
3. **La UI nunca importa `lib/ai/`, `lib/voice/` ni el cliente admin.**
4. **Un solo camino de datos:** hooks → services → Supabase (RLS). NO se construye
   una capa REST paralela "por si acaso" (lección aprendida de ReadHub: quedó una
   API v1 completa que el frontend nunca llamó).
5. **Todo tunable vive en `lib/constants/`** con un comentario que justifica su valor.

## Lección de ReadHub incorporada

- Los embeddings de Hugging Face **deben** usar el SDK `@huggingface/inference`
  (`featureExtraction`), no el router REST (no soporta feature-extraction).
- La disponibilidad de modelos gratuitos del router **rota**: el modelo de chat se
  configura por variable de entorno para poder cambiarlo sin tocar código.
- La dimensión del vector (384) queda fijada en la columna SQL: cambiar de modelo
  de embeddings implica migración (`ALTER COLUMN ... TYPE vector(N)` + recrear
  índice y función).
- En CI se fija la versión de npm (deps opcionales de Linux ausentes en el lockfile
  generado en Windows) y el E2E corre contra un Supabase local efímero, sin secretos.
