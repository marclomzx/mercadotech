import { buildRagUserMessage } from "@/lib/ai/prompts";
import {
  CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS,
  CONTEXT_BUILDER_DEFAULT_MAX_SOURCES,
  CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY,
  CONTEXT_BUILDER_MIN_CONTENT_LENGTH,
  CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS,
} from "@/lib/constants/ai";

// El "criterio del bibliotecario": de todas las fichas que la búsqueda
// recuperó, cuáles entran de verdad al escritorio del redactor y en qué
// orden, sin pasarse del espacio disponible.
//
// Función PURA: cero red, cero Supabase, cero React. Todo lo que necesita
// llega por parámetro y siempre devuelve lo mismo para la misma entrada.
// Por eso se puede probar entera con datos en memoria (sesión 6).
//
// La entrada se declara ESTRUCTURALMENTE acá, en vez de importar VectorMatch
// de services/vector-search.service.ts: los services dependen de lib/ai, no
// al revés. VectorMatch satisface este tipo por estructura (TypeScript es
// estructural), así que el caller pasa sus resultados sin conversión alguna,
// y este módulo no adquiere ninguna dependencia hacia la capa de datos.

export type ContextCandidate = {
  sourceType: string;
  sourceId: string;
  content: string;
  metadata?: Record<string, unknown> | null;
  similarity: number;
};

export type ContextSource = {
  sourceType: string;
  sourceId: string;
  title: string;
  // El contenido TAL COMO se envió al modelo (recortado si el presupuesto lo
  // exigió). Se conserva para poder auditar exactamente qué leyó el modelo,
  // que es el insumo de la calibración de la Fase 4.8.
  content: string;
  similarity: number;
};

export type BuildContextOptions = {
  maxSources?: number;
  minSimilarity?: number;
  minContentLength?: number;
  maxContextChars?: number;
  minTruncatedSourceChars?: number;
};

export type BuiltContext = {
  userMessage: string;
  sources: ContextSource[];
  stats: {
    // true SOLO si el presupuesto de caracteres dejó fuera contenido que ya
    // había pasado la selección. Que se hayan filtrado fuentes por baja
    // similitud NO es truncado: son dos señales distintas y confundirlas
    // haría inútil la calibración de la 4.8.
    contextTruncated: boolean;
    // Caracteres de CONTENIDO efectivamente incluidos. No cuenta la
    // numeración ni los títulos que agrega buildRagUserMessage (~30 chars por
    // fuente): son despreciables frente al presupuesto, que además ya se
    // define con holgura sobre la ventana del modelo.
    totalChars: number;
  };
};

const UNTITLED_SOURCE = "Sin título";

// El título vive en metadata (lo escribe embedding.service al fichar). Se lee
// defensivamente porque metadata es jsonb: nada garantiza su forma en tiempo
// de tipos.
function readTitle(metadata: Record<string, unknown> | null | undefined): string {
  const title = metadata?.title;
  return typeof title === "string" && title.trim() ? title.trim() : UNTITLED_SOURCE;
}

/**
 * Selecciona qué fuentes entran al contexto del modelo y arma el mensaje.
 *
 * @param query      La pregunta del usuario, tal cual.
 * @param candidates Resultados de la búsqueda vectorial (VectorMatch[] los
 *                   satisface sin conversión).
 * @param options    Sobreescribe cualquier umbral; los defaults salen de
 *                   lib/constants/ai.ts, nada está hardcodeado acá.
 */
export function buildContext(
  query: string,
  candidates: ContextCandidate[],
  options: BuildContextOptions = {},
): BuiltContext {
  const maxSources = options.maxSources ?? CONTEXT_BUILDER_DEFAULT_MAX_SOURCES;
  const minSimilarity = options.minSimilarity ?? CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY;
  const minContentLength = options.minContentLength ?? CONTEXT_BUILDER_MIN_CONTENT_LENGTH;
  const maxContextChars = options.maxContextChars ?? CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS;
  const minTruncatedSourceChars =
    options.minTruncatedSourceChars ?? CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS;

  // ============================================================
  // (1) SELECCIÓN — qué fichas son siquiera candidatas
  // ============================================================
  //
  // Se vuelve a filtrar por similitud aunque la búsqueda ya lo hizo: este
  // módulo no puede confiar en que le lleguen filtradas (puede recibir
  // resultados de otra fuente, o con otro umbral).
  //
  // .filter() ya devuelve un array nuevo, así que el .sort() posterior no
  // muta la entrada del caller — requisito de una función pura.
  const selected = candidates
    .filter(
      (candidate) =>
        candidate.similarity >= minSimilarity &&
        candidate.content.trim().length >= minContentLength,
    )
    // Orden estable garantizado por ES2019: ante similitudes empatadas se
    // conserva el orden de entrada (el que ya venía ordenado del RPC), así
    // que la función es determinista sin inventar un desempate.
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, Math.max(0, maxSources));

  // ============================================================
  // (2) PRESUPUESTO — cuánto de eso cabe en el escritorio
  // ============================================================
  const sources: ContextSource[] = [];
  let totalChars = 0;
  let contextTruncated = false;

  for (const candidate of selected) {
    const content = candidate.content.trim();
    const remaining = maxContextChars - totalChars;

    if (content.length <= remaining) {
      sources.push({
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
        title: readTitle(candidate.metadata),
        content,
        similarity: candidate.similarity,
      });
      totalChars += content.length;
      continue;
    }

    // No cabe entera. Entra recortada solo si le queda espacio suficiente
    // para aportar algo: con menos de minTruncatedSourceChars se descarta
    // ENTERA, porque media frase suelta confunde al modelo más de lo que
    // aporta. Se recorta con slice y no en el último espacio: cortar en
    // frontera de palabra podría dejar el fragmento por debajo del mínimo
    // que se acaba de validar.
    if (remaining >= minTruncatedSourceChars) {
      const clipped = content.slice(0, remaining);
      sources.push({
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
        title: readTitle(candidate.metadata),
        content: clipped,
        similarity: candidate.similarity,
      });
      totalChars += clipped.length;
    }

    // En ambos casos (recortada o descartada) el presupuesto dejó fuera
    // contenido ya seleccionado.
    contextTruncated = true;

    // Se corta el recorrido en vez de seguir buscando una fuente más chica
    // que quepa en el hueco: las fuentes vienen ordenadas por relevancia, y
    // colar una menos relevante salteando a una más relevante rompería esa
    // promesa — el número de cita [N] dejaría de reflejar el ranking.
    break;
  }

  // ============================================================
  // (3) SALIDA
  // ============================================================
  return {
    // Se delega en prompts.ts: este módulo decide QUÉ entra, no CÓMO se
    // redacta el mensaje. Con sources vacío, buildRagUserMessage ya emite la
    // variante que dice explícitamente que no hubo información relevante.
    userMessage: buildRagUserMessage(
      query,
      sources.map((source) => ({ title: source.title, content: source.content })),
    ),
    sources,
    stats: { contextTruncated, totalChars },
  };
}
