-- Políticas y GRANTs de knowledge_embeddings.
--
-- ⚠️ El `revoke all on all tables in schema public` de la migración
-- 20260830130000 NO cubre esta tabla: aquella corrió antes de que existiera.
-- Y Supabase mantiene un ALTER DEFAULT PRIVILEGES que otorga ALL PRIVILEGES a
-- anon/authenticated/service_role sobre cada tabla nueva creada por
-- `postgres`. Sin este REVOKE, anon tendría SELECT (y hasta DELETE) sobre las
-- fichas pese a que más abajo no se le concede nada: GRANT es aditivo y nunca
-- retira un privilegio preexistente.
revoke all on public.knowledge_embeddings from anon, authenticated;

-- Decisión 1 de la spec: la IA exige sesión iniciada. SELECT se concede a
-- `authenticated` y NO a `anon` — es lo que hace que la pestaña "Resultados
-- con IA" y los asistentes pidan login, y de paso protege la cuota gratuita
-- del proveedor de embeddings frente a tráfico anónimo.
grant select on public.knowledge_embeddings to authenticated;

-- INSERT/UPDATE/DELETE: sin GRANT y sin política, a propósito. Las fichas las
-- escribe únicamente el cliente service_role (que bypassa RLS por completo),
-- desde el Route Handler de reindexado y el script index-all. Ningún usuario
-- final, ni siquiera autenticado, puede fabricar o borrar una ficha: eso
-- permitiría envenenar el contexto que lee el modelo de lenguaje.

-- Sin restricción por fila: cualquier usuario con sesión puede leer cualquier
-- ficha. Filtrar acá por "producto activo" no es posible sin un join contra
-- products, que volvería la política costosa y recursiva de mantener; el
-- filtrado real (productos inactivos, fuentes borradas) lo hace
-- vector-search.service al hidratar los resultados contra products.
create policy "knowledge_embeddings_select_authenticated" on public.knowledge_embeddings
  for select
  to authenticated
  using (true);
