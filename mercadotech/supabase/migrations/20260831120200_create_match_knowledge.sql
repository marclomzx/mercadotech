-- MATCH_KNOWLEDGE: dado el embedding de una pregunta, devuelve las fichas más
-- parecidas por significado, de la más similar a la menos.
--
-- SECURITY INVOKER (el default explícito, para dejar la decisión a la vista)
-- y NO security definer como create_order_from_cart. La diferencia importa:
-- aquella función DEBÍA saltarse la RLS porque escribe en orders/order_items,
-- donde el comprador no tiene GRANT ni política de INSERT. Esta solo LEE, y
-- se quiere exactamente lo contrario: que respete la visibilidad del caller,
-- de modo que un anónimo — sin política SELECT sobre knowledge_embeddings,
-- decisión 1 de la spec: la IA exige sesión — no obtenga fichas ni siquiera
-- invocando la función. Con SECURITY DEFINER, esta función sería un agujero
-- que sortea la RLS que la migración siguiente define.
--
-- search_path fijado (no heredado del caller) por la misma razón que en el
-- resto de funciones del proyecto: evita que alguien anteponga un schema
-- propio y secuestre a qué tabla u operador resuelven los nombres de adentro.
-- Incluye `extensions` porque ahí viven el tipo vector y el operador <=>.
create function public.match_knowledge(
  query_embedding extensions.vector(384),
  p_source_type text default null,
  match_count int default 5,
  similarity_threshold float default 0.3
)
returns table (
  source_type text,
  source_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    ke.source_type,
    ke.source_id,
    ke.content,
    ke.metadata,
    -- <=> es distancia coseno: 0 = idéntico, 2 = opuesto. La similitud que
    -- espera el resto del sistema es 1 - distancia (1 = idéntico), que es la
    -- escala en la que están expresados los thresholds de lib/constants/ai.ts.
    1 - (ke.embedding <=> query_embedding) as similarity
  from public.knowledge_embeddings ke
  where
    -- p_source_type null = buscar en AMBAS fuentes (lo usa el modo mixto);
    -- con valor, filtra a productos o a artículos.
    (p_source_type is null or ke.source_type = p_source_type)
    and 1 - (ke.embedding <=> query_embedding) >= similarity_threshold
  -- Se ordena por la DISTANCIA ascendente y no por la similitud descendente
  -- a propósito: solo esa forma coincide con el operador del índice HNSW y
  -- permite que el planificador lo use. Da el mismo orden, porque la
  -- similitud es 1 - distancia (monótona inversa).
  order by ke.embedding <=> query_embedding
  limit match_count;
$$;

-- Mismo patrón que create_order_from_cart: la función queda disponible solo
-- para usuarios autenticados. anon no puede ni invocarla (decisión 1), lo que
-- da una segunda barrera además de la ausencia de política SELECT.
revoke execute on function public.match_knowledge(extensions.vector, text, int, float) from public;
revoke execute on function public.match_knowledge(extensions.vector, text, int, float) from anon;
grant execute on function public.match_knowledge(extensions.vector, text, int, float) to authenticated;
