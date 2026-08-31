-- KNOWLEDGE_EMBEDDINGS: el "fichero" del RAG. Una fila por trozo de contenido
-- vectorizado, con el texto que se vectorizó y su embedding.
--
-- UNA tabla para las dos fuentes (productos y artículos de soporte),
-- discriminada por source_type, en vez de dos tablas gemelas: ambas fuentes
-- tienen exactamente la misma forma (texto + vector + metadata) y se
-- consultan juntas — match_knowledge con p_source_type null busca en las dos
-- con una sola pasada del índice. Dos tablas obligarían a duplicar índice,
-- RPC, políticas y service, y a un UNION para la búsqueda conjunta. Agregar
-- una fuente futura (ej. reseñas) es un valor más en el check, no otra tabla.
create table public.knowledge_embeddings (
  id uuid primary key default gen_random_uuid(),

  source_type text not null check (source_type in ('producto', 'articulo_soporte')),

  -- Supuesto: source_id va SIN foreign key porque apunta a DOS tablas origen
  -- distintas (products o support_articles según source_type), y Postgres no
  -- admite una FK con destino condicional. Las alternativas (dos columnas
  -- nullables con FK cada una, o herencia) complican la unicidad y el índice
  -- sin ganar nada aquí.
  -- Consecuencia asumida: al borrar un producto o un artículo, su ficha queda
  -- HUÉRFANA (la base no la limpia sola). Se maneja en dos lugares:
  --   1. vector-search.service descarta los resultados cuya fuente ya no
  --      existe o está inactiva, al hidratar contra products.
  --   2. El endpoint de reindexado borra las fichas de una fuente que ya no
  --      existe (limpieza best-effort al publicar/editar/borrar).
  -- Las fichas son derivadas, nunca la fuente de verdad: borrar la tabla
  -- entera y correr scripts/index-all.ts la reconstruye desde cero.
  source_id uuid not null,

  -- Preparado para chunking: hoy cada fuente entra como un solo trozo
  -- (chunk_index = 0), pero la columna y el unique ya admiten dividir un
  -- contenido largo en varios sin cambiar el esquema.
  chunk_index integer not null default 0,

  -- El texto EXACTO que se envió a generar el embedding. Se guarda para poder
  -- auditar qué "leyó" el modelo y para armar el contexto del chat sin volver
  -- a consultar la tabla origen.
  content text not null,

  -- ⚠️ La dimensión 384 corresponde a sentence-transformers/all-MiniLM-L6-v2
  -- y queda GRABADA en el tipo de la columna. Cambiar a un modelo de
  -- embeddings con otra dimensión NO se resuelve cambiando la variable de
  -- entorno HUGGINGFACE_EMBEDDING_MODEL: exige una migración nueva que haga
  --   alter table public.knowledge_embeddings
  --     alter column embedding type extensions.vector(N) using null;
  -- y además RECREAR el índice HNSW de abajo y la función match_knowledge
  -- (su parámetro query_embedding también declara la dimensión). Después hay
  -- que re-generar todas las fichas: los vectores viejos no son comparables
  -- con los nuevos.
  embedding extensions.vector(384) not null,

  -- Datos de presentación de la fuente (título, categoría, precio…) copiados
  -- al momento de fichar, para que la búsqueda pueda mostrar resultados sin
  -- un join. Los valores volátiles (precio, stock, imagen) se re-hidratan
  -- igualmente contra products al presentar, porque acá pueden estar viejos.
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  -- Una sola ficha por (fuente, trozo): es lo que permite que el reindexado
  -- sea un upsert idempotente — editar un producto actualiza su ficha en vez
  -- de acumular duplicados.
  unique (source_type, source_id, chunk_index)
);

alter table public.knowledge_embeddings enable row level security;

-- Índice HNSW con vector_cosine_ops: la búsqueda usa distancia coseno (<=>),
-- que es la métrica para la que all-MiniLM-L6-v2 fue entrenado. El opclass
-- DEBE coincidir con el operador que usa la consulta; si no coincide, el
-- índice existe pero el planificador lo ignora y cae a scan secuencial.
--
-- HNSW (y no IVFFlat) porque no requiere entrenar sobre datos ya cargados:
-- funciona desde la primera fila, que es justo el caso acá — la tabla nace
-- vacía y se puebla por script/trigger.
create index knowledge_embeddings_embedding_hnsw
  on public.knowledge_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

-- Filtrar por tipo antes de comparar vectores es lo habitual (compras busca
-- solo productos; soporte solo artículos), así que conviene un índice btree
-- de apoyo sobre la columna discriminadora.
create index knowledge_embeddings_source_type_idx
  on public.knowledge_embeddings (source_type);
