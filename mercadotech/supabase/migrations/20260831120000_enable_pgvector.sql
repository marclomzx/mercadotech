-- pgvector: provee el tipo `vector` y los operadores de distancia (<=>, <->,
-- <#>) que usa la búsqueda semántica de la sesión 4.
--
-- Se instala en `extensions` y no en `public` por la misma razón que pgcrypto
-- (migración 20260830120000): `public` es el schema expuesto por la Data API
-- de Supabase, y no conviene publicar ahí los objetos de una extensión.
-- Consecuencia: el tipo y sus operadores se referencian como
-- `extensions.vector` / con `search_path` que incluya `extensions`.
create extension if not exists vector with schema extensions;
