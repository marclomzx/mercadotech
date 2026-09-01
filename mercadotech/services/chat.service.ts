import type { SupabaseClient } from "@supabase/supabase-js";

import { buildContext, type BuildContextOptions } from "@/lib/ai/context-builder";
import { generateCompletion } from "@/lib/ai/completion";
import { SHOPPING_SYSTEM_INSTRUCTIONS, SUPPORT_SYSTEM_INSTRUCTIONS } from "@/lib/ai/prompts";
import type { SourceType } from "@/services/embedding.service";
import * as vectorSearchService from "@/services/vector-search.service";
import type { ChatMode, ChatResult } from "@/types/chat";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

// ORQUESTADOR. No implementa nada propio:
//   - no habla con Hugging Face   → lib/ai/completion
//   - no arma prompts             → lib/ai/prompts
//   - no consulta knowledge_embeddings → services/vector-search
//   - no decide qué contexto entra ni lo recorta → lib/ai/context-builder
// Si esta fase necesitara algo nuevo, va en la capa dueña, no acá.

// El ÚNICO lugar que sabe que existen modos. Cada modo es exactamente dos
// decisiones: dónde buscar y con qué instrucciones responder. Agregar un
// tercer asistente mañana es una entrada más en esta tabla.
const MODE_CONFIG: Record<ChatMode, { sourceType: SourceType; systemInstructions: string }> = {
  compras: {
    sourceType: "producto",
    systemInstructions: SHOPPING_SYSTEM_INSTRUCTIONS,
  },
  soporte: {
    sourceType: "articulo_soporte",
    systemInstructions: SUPPORT_SYSTEM_INSTRUCTIONS,
  },
};

export type AskOptions = {
  // Cuántas fichas pedirle a la búsqueda (antes del filtrado del contexto).
  topK?: number;
  similarityThreshold?: number;
} & BuildContextOptions;

/**
 * Responde una consulta usando SOLO el conocimiento indexado de la
 * plataforma: busca → arma contexto → redacta citando fuentes.
 *
 * El cliente es OBLIGATORIO y sin default, a diferencia de los services de
 * la sesión 3: esta función es server-only (necesita el token de Hugging
 * Face) y debe recibir el cliente de SESIÓN, para que la RLS de
 * knowledge_embeddings se aplique con las credenciales de quien pregunta.
 * Un default de navegador invitaría justo al error que se quiere evitar.
 */
export async function ask(
  query: string,
  mode: ChatMode,
  opts: AskOptions = {},
  supabase: Client,
): Promise<ChatResult> {
  const { sourceType, systemInstructions } = MODE_CONFIG[mode];

  // 1. Recuperar: fichas parecidas, acotadas a la fuente del modo.
  const matches = await vectorSearchService.searchByQuery(
    query,
    { sourceType, topK: opts.topK, similarityThreshold: opts.similarityThreshold },
    supabase,
  );

  // 2. Elegir: qué entra al contexto y en qué orden (función pura).
  const context = buildContext(query, matches, opts);

  // 3. Redactar. Se llama SIEMPRE, incluso sin contexto relevante: las
  //    instrucciones de cada modo ya indican qué responder en ese caso
  //    ("no encontré productos que coincidan" / sugerir un ticket), y
  //    buildRagUserMessage emite la variante que lo dice explícitamente.
  //    Cortocircuitar acá con un texto fijo duplicaría esa decisión en dos
  //    lugares y haría que el asistente sonara distinto al fallar.
  const completion = await generateCompletion(systemInstructions, context.userMessage);

  return {
    query,
    answer: completion.text,
    hasRelevantContext: context.sources.length > 0,
    sources: context.sources.map((source) => ({
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      title: source.title,
      similarity: source.similarity,
      // La metadata original de la ficha; buildContext no la propaga porque
      // no la necesita para decidir, así que se recupera del match.
      metadata:
        matches.find((match) => match.sourceId === source.sourceId)?.metadata ?? {},
    })),
    metadata: {
      model: completion.model,
      retrievedCount: matches.length,
      usedSourceCount: context.sources.length,
      contextTruncated: context.stats.contextTruncated,
    },
  };
}
