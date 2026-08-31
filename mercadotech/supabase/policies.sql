-- Copia de referencia de las políticas RLS y GRANTs. NO es la fuente de
-- verdad: la fuente de verdad es supabase/migrations/20260830130000_create_rls_policies.sql.
-- Este archivo se regenera a mano cada vez que cambian las políticas.
--
-- Requiere el esquema de supabase/schema.sql ya aplicado (todas las tablas
-- con RLS habilitado, sin políticas todavía).

grant usage on schema public to anon, authenticated;

-- Supabase define ALTER DEFAULT PRIVILEGES en su propio bootstrap de
-- plataforma para que cada tabla nueva creada por `postgres` reciba
-- automáticamente ALL PRIVILEGES para anon/authenticated/service_role. Sin
-- este REVOKE, los GRANTs específicos de más abajo no restringen nada: GRANT
-- es aditivo y nunca retira un privilegio que ya existía por ese default.
-- (Verificado contra la base real: sin este REVOKE, anon tenía DELETE en
-- cart_items y authenticated tenía INSERT en orders/order_items pese a que
-- ninguno de los dos GRANT aparece más abajo.)
revoke all on all tables in schema public from anon, authenticated;

-- ============================================================
-- Funciones helper
-- ============================================================

-- SECURITY DEFINER es obligatorio aquí: si is_admin() corriera con los
-- privilegios del caller, y se llama desde dentro de la propia política de
-- profiles (que también consulta profiles), entraría en recursión infinita
-- contra la RLS de profiles. Con SECURITY DEFINER, la lectura a profiles de
-- adentro de la función se hace como el dueño de la función (bypassa RLS),
-- rompiendo la recursión.
create function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

-- ============================================================
-- PROFILES
-- ============================================================

grant select, update on public.profiles to authenticated;
-- Sin INSERT/DELETE: el insert lo hace el trigger handle_new_user (Fase 2.2)
-- corriendo como su dueño (bypassa RLS); el delete no está permitido a nadie
-- (el profile se borra solo en cascada si se borra el auth.users).

-- El propio dueño (o un admin) puede ver su profile.
create policy "profiles_select_own_or_admin" on public.profiles
  for select
  using ((select auth.uid()) = id or public.is_admin());

-- Solo el propio dueño puede editar SU profile (el admin no tiene bypass
-- aquí: cambios de rol de otros usuarios se hacen server-side con el
-- cliente admin, no vía este UPDATE — ver protect_profile_role más abajo).
create policy "profiles_update_own" on public.profiles
  for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Un usuario no puede auto-promoverse: bloquea cualquier UPDATE que cambie
-- `role`, salvo que lo haga un admin o el cliente de service role (futura
-- gestión de roles server-side vía lib/supabase/admin.ts).
create function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and not public.is_admin()
     and auth.role() is distinct from 'service_role' then
    raise exception 'No tienes permiso para cambiar tu propio rol';
  end if;
  return new;
end;
$$;

create trigger protect_profile_role_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ============================================================
-- CATEGORIES
-- ============================================================

grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

-- El árbol de categorías es público, sin login (catálogo abierto).
create policy "categories_select_all" on public.categories
  for select
  using (true);

create policy "categories_insert_admin" on public.categories
  for insert
  with check (public.is_admin());

create policy "categories_update_admin" on public.categories
  for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "categories_delete_admin" on public.categories
  for delete
  using (public.is_admin());

-- ============================================================
-- PRODUCTS
-- ============================================================

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

-- Catálogo público: activos para todos; el vendedor ve además sus propios
-- productos inactivos (borradores/pausados) en su panel.
create policy "products_select_active_or_own" on public.products
  for select
  using (is_active or seller_id = (select auth.uid()));

-- Solo un usuario con rol 'seller' puede publicar, y únicamente a su propio
-- nombre (seller_id = quien inserta). El chequeo de rol solo hace falta acá:
-- en UPDATE/DELETE la propiedad (seller_id = auth.uid()) ya implica que es
-- vendedor, porque solo un vendedor pudo haber creado la fila.
create policy "products_insert_own_as_seller" on public.products
  for insert
  with check (
    seller_id = (select auth.uid())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'seller'
    )
  );

create policy "products_update_own" on public.products
  for update
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

create policy "products_delete_own" on public.products
  for delete
  using (seller_id = (select auth.uid()));

-- ============================================================
-- PRODUCT_IMAGES
-- ============================================================

grant select on public.product_images to anon, authenticated;
grant insert, update, delete on public.product_images to authenticated;

-- Misma visibilidad que su producto: activo (todos) o propio (vendedor).
create policy "product_images_select_visible_product" on public.product_images
  for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and (p.is_active or p.seller_id = (select auth.uid()))
    )
  );

create policy "product_images_insert_own_product" on public.product_images
  for insert
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.seller_id = (select auth.uid())
    )
  );

create policy "product_images_update_own_product" on public.product_images
  for update
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.seller_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.seller_id = (select auth.uid())
    )
  );

create policy "product_images_delete_own_product" on public.product_images
  for delete
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
        and p.seller_id = (select auth.uid())
    )
  );

-- ============================================================
-- CART_ITEMS
-- ============================================================

grant select, insert, update, delete on public.cart_items to authenticated;

-- Los compradores solo ven y editan SU propio carrito.
create policy "cart_items_select_own" on public.cart_items
  for select
  using ((select auth.uid()) = user_id);

create policy "cart_items_insert_own" on public.cart_items
  for insert
  with check ((select auth.uid()) = user_id);

create policy "cart_items_update_own" on public.cart_items
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "cart_items_delete_own" on public.cart_items
  for delete
  using ((select auth.uid()) = user_id);

-- ============================================================
-- ORDERS
-- ============================================================

grant select, update on public.orders to authenticated;
-- Sin INSERT: los pedidos solo se crean vía create_order_from_cart()
-- (SECURITY DEFINER), nunca por INSERT directo del cliente — por eso ni
-- siquiera se otorga el GRANT de INSERT a authenticated/anon. Sin DELETE:
-- un pedido nunca se borra (es un registro histórico/financiero).

-- orders y order_items se referencian mutuamente en sus políticas (orders
-- necesita saber si el vendedor tiene ítems en el pedido; order_items
-- necesita saber si el pedido es del comprador). Consultar la tabla vecina
-- con un EXISTS directo en AMBOS sentidos provoca "infinite recursion
-- detected in policy": evaluar la RLS de orders dispara la RLS de
-- order_items, que a su vez vuelve a evaluar la RLS de orders, sin fin.
-- (Se detectó justo así: pasaba inadvertido con `set role` + SQL crudo en la
-- Fase 2.3, pero rompía apenas se consultaba vía la Data API real.)
--
-- La salida es el mismo patrón que is_admin(): una función SECURITY DEFINER
-- que consulta order_items como su dueño (con BYPASSRLS), sin volver a
-- evaluar la RLS de order_items. Rompe el ciclo solo del lado de orders —
-- alcanza, porque una vez que orders ya no dispara la RLS de order_items,
-- que order_items sí consulte orders deja de ser recursivo.
create function public.order_has_own_item(p_order_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.order_items oi
    where oi.order_id = p_order_id
      and oi.seller_id = (select auth.uid())
  );
$$;

-- El comprador dueño, el vendedor que tiene ítems en el pedido, o un admin.
create policy "orders_select_buyer" on public.orders
  for select
  using (buyer_id = (select auth.uid()));

create policy "orders_select_seller_with_items" on public.orders
  for select
  using (public.order_has_own_item(orders.id));

create policy "orders_select_admin" on public.orders
  for select
  using (public.is_admin());

-- El vendedor con ítems en el pedido solo puede AVANZARLO por el pipeline de
-- cumplimiento (pagado/enviado/entregado) — nunca reabrirlo a 'pendiente' ni
-- cancelarlo (eso es decisión del comprador mientras está 'pendiente').
create policy "orders_update_seller_advance_status" on public.orders
  for update
  using (public.order_has_own_item(orders.id))
  with check (status in ('pagado', 'enviado', 'entregado'));

-- El comprador dueño solo puede cancelar mientras el pedido siga 'pendiente'.
create policy "orders_update_buyer_cancel_pending" on public.orders
  for update
  using (buyer_id = (select auth.uid()) and status = 'pendiente')
  with check (buyer_id = (select auth.uid()) and status = 'cancelado');

-- ============================================================
-- ORDER_ITEMS
-- ============================================================

grant select on public.order_items to authenticated;
-- Sin INSERT/UPDATE/DELETE: order_items solo lo escribe
-- create_order_from_cart() (SECURITY DEFINER); ni siquiera se otorga GRANT
-- para esas operaciones a authenticated/anon.

create policy "order_items_select_buyer" on public.order_items
  for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.buyer_id = (select auth.uid())
    )
  );

create policy "order_items_select_seller_own" on public.order_items
  for select
  using (seller_id = (select auth.uid()));

create policy "order_items_select_admin" on public.order_items
  for select
  using (public.is_admin());

-- ============================================================
-- QUESTIONS
-- ============================================================

grant select on public.questions to anon, authenticated;
grant insert, update, delete on public.questions to authenticated;

-- El producto es público: cualquiera ve sus preguntas y respuestas, sin login.
create policy "questions_select_all" on public.questions
  for select
  using (true);

-- Cualquier usuario autenticado puede preguntar, a su propio nombre.
create policy "questions_insert_own" on public.questions
  for insert
  with check ((select auth.uid()) = user_id);

-- Solo el vendedor dueño del producto puede escribir la respuesta.
create policy "questions_update_seller_answers" on public.questions
  for update
  using (
    exists (
      select 1 from public.products p
      where p.id = questions.product_id
        and p.seller_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = questions.product_id
        and p.seller_id = (select auth.uid())
    )
  );

-- El autor de la pregunta o un admin pueden borrarla (moderación).
create policy "questions_delete_author_or_admin" on public.questions
  for delete
  using ((select auth.uid()) = user_id or public.is_admin());

-- ============================================================
-- REVIEWS
-- ============================================================

grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;

-- Reseñas públicas: cualquiera las ve, sin login.
create policy "reviews_select_all" on public.reviews
  for select
  using (true);

-- Reseña verificada: solo quien compró el producto y su pedido ya está
-- 'entregado' (EXISTS sobre orders + order_items, ambos referenciados por
-- el order_id/product_id que trae la fila nueva).
create policy "reviews_insert_verified_purchase" on public.reviews
  for insert
  with check (
    buyer_id = (select auth.uid())
    and exists (
      select 1
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      where o.id = reviews.order_id
        and o.buyer_id = (select auth.uid())
        and o.status = 'entregado'
        and oi.product_id = reviews.product_id
    )
  );

create policy "reviews_update_own" on public.reviews
  for update
  using ((select auth.uid()) = buyer_id)
  with check ((select auth.uid()) = buyer_id);

-- El autor o un admin pueden borrar la reseña (moderación).
create policy "reviews_delete_author_or_admin" on public.reviews
  for delete
  using ((select auth.uid()) = buyer_id or public.is_admin());

-- ============================================================
-- FAVORITES
-- ============================================================

grant select, insert, delete on public.favorites to authenticated;
-- Sin UPDATE: un favorito se agrega o se quita, no se edita in-place.

create policy "favorites_select_own" on public.favorites
  for select
  using ((select auth.uid()) = user_id);

create policy "favorites_insert_own" on public.favorites
  for insert
  with check ((select auth.uid()) = user_id);

create policy "favorites_delete_own" on public.favorites
  for delete
  using ((select auth.uid()) = user_id);

-- ============================================================
-- PRODUCT_VIEWS
-- ============================================================

grant select, insert on public.product_views to authenticated;
-- Sin UPDATE/DELETE: cada fila es un evento inmutable, no un contador.

-- El vendedor ve las vistas de SUS productos (analítica); el admin ve todo.
create policy "product_views_select_seller_own" on public.product_views
  for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_views.product_id
        and p.seller_id = (select auth.uid())
    )
  );

create policy "product_views_select_admin" on public.product_views
  for select
  using (public.is_admin());

-- Cualquier usuario autenticado puede registrar su propia vista.
create policy "product_views_insert_own" on public.product_views
  for insert
  with check ((select auth.uid()) = user_id);

-- ============================================================
-- SUPPORT_ARTICLES
-- ============================================================

grant select on public.support_articles to anon, authenticated;
grant insert, update, delete on public.support_articles to authenticated;

-- FAQ pública para artículos publicados; el admin además ve sus propios
-- borradores (is_published = false) para poder gestionarlos antes de
-- publicarlos — sin esto, INSERT/UPDATE/DELETE de admin serían inútiles
-- sobre cualquier borrador que él mismo cree.
create policy "support_articles_select_published_or_admin" on public.support_articles
  for select
  using (is_published or public.is_admin());

create policy "support_articles_insert_admin" on public.support_articles
  for insert
  with check (public.is_admin());

create policy "support_articles_update_admin" on public.support_articles
  for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "support_articles_delete_admin" on public.support_articles
  for delete
  using (public.is_admin());

-- ============================================================
-- SUPPORT_TICKETS
-- ============================================================

grant select, insert, update on public.support_tickets to authenticated;
-- Sin DELETE: un ticket de soporte no se borra, queda como historial.

create policy "support_tickets_select_own_or_admin" on public.support_tickets
  for select
  using ((select auth.uid()) = user_id or public.is_admin());

create policy "support_tickets_insert_own" on public.support_tickets
  for insert
  with check ((select auth.uid()) = user_id);

-- El dueño del ticket solo puede cerrarlo (única transición que se le
-- permite); el admin puede actualizarlo libremente (reasignar estado, etc.).
create policy "support_tickets_update_owner_close" on public.support_tickets
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and status = 'cerrado');

create policy "support_tickets_update_admin" on public.support_tickets
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- TICKET_MESSAGES
-- ============================================================

grant select, insert on public.ticket_messages to authenticated;
-- Sin UPDATE/DELETE: el historial del chat de soporte es inmutable.

create policy "ticket_messages_select_ticket_owner_or_admin" on public.ticket_messages
  for select
  using (
    exists (
      select 1 from public.support_tickets st
      where st.id = ticket_messages.ticket_id
        and st.user_id = (select auth.uid())
    )
    or public.is_admin()
  );

create policy "ticket_messages_insert_ticket_owner_or_admin" on public.ticket_messages
  for insert
  with check (
    exists (
      select 1 from public.support_tickets st
      where st.id = ticket_messages.ticket_id
        and st.user_id = (select auth.uid())
    )
    or public.is_admin()
  );

-- ================================================================
-- Fase 2.4 — Storage: buckets y políticas sobre storage.objects.
-- Fuente de verdad: supabase/migrations/20260830140000_create_storage_buckets.sql
-- ================================================================

-- Buckets de Storage + políticas sobre storage.objects.
--
-- A diferencia de las tablas de `public` (Fase 2.3), storage.objects y
-- storage.buckets son propiedad de `supabase_storage_admin`, no de
-- `postgres` (el rol con el que corren las migraciones). `postgres` no es
-- superusuario: puede AGREGAR grants (porque supabase_storage_admin se los
-- otorgó con WITH GRANT OPTION), pero NO puede revocar el grant amplio que
-- supabase_storage_admin ya le dio a anon/authenticated de fábrica — un
-- REVOKE solo puede deshacer lo que el mismo rol otorgó. Se probó
-- explícitamente contra la base real: después de un `revoke all`, anon y
-- authenticated seguían apareciendo con todos los privilegios.
--
-- Verificado con pruebas reales (insert/update/delete simulando anon y
-- authenticated vía `set role` + `request.jwt.claims`) que esto NO es un
-- problema de seguridad: con RLS habilitado, las políticas de abajo son la
-- única puerta real — un INSERT de anon, o de authenticated fuera de su
-- carpeta, es rechazado por RLS aunque el GRANT de tabla lo permita en
-- principio; un UPDATE (sin política) afecta 0 filas siempre. El GRANT
-- amplio heredado queda inerte. Por eso este archivo no revoca nada de
-- storage.buckets/objects — sería un REVOKE que no revoca y daría una falsa
-- sensación de restricción — y en vez de eso documenta que RLS es la capa
-- de seguridad real aquí.

grant select, insert, delete on storage.objects to authenticated;
grant select on storage.objects to anon;
-- Estos GRANT no restringen nada por sí solos (ver nota de arriba) — se
-- dejan como documentación explícita de intención, coherente con la Fase
-- 2.3, por si el default de la plataforma cambia en el futuro.
--
-- Sin UPDATE: el flujo de vendedor/usuario es "subir + borrar", nunca
-- reemplazar un objeto in-place. Para cambiar una imagen se borra la vieja y
-- se sube una nueva con otro nombre (ej. product-images/{seller}/{product}/2.jpg)
-- — evita la complejidad de políticas de UPDATE sobre storage.objects
-- (que tienen que validar tanto la fila OLD como la NEW) sin perder
-- funcionalidad real para el usuario.

-- ============================================================
-- Buckets
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

-- ============================================================
-- product-images — convención de path: {seller_id}/{product_id}/{n}.{ext}
-- ============================================================

-- Lectura pública. El bucket ya es `public = true` (URLs directas no pasan
-- por RLS), pero se agrega también la política de SELECT porque operaciones
-- como listar una carpeta (`.list()` del SDK) sí evalúan RLS sobre
-- storage.objects, a diferencia de la descarga por URL pública directa.
create policy "product_images_bucket_select_all" on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'product-images');

-- Un vendedor solo puede subir dentro de SU propia carpeta raíz: el primer
-- segmento del path debe ser su propio uid. No se valida acá que el
-- product_id (segundo segmento) le pertenezca — esa verificación ya vive en
-- la política de INSERT de public.product_images (Fase 2.3); acá el único
-- límite de seguridad es "no escribir en la carpeta de otro usuario".
create policy "product_images_bucket_insert_own_folder" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "product_images_bucket_delete_own_folder" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ============================================================
-- avatars — convención de path: {user_id}/...
-- ============================================================

create policy "avatars_bucket_select_all" on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'avatars');

create policy "avatars_bucket_insert_own_folder" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_bucket_delete_own_folder" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ============================================================
-- KNOWLEDGE_EMBEDDINGS (sesión 4, Fase 4.1)
-- ============================================================

-- ⚠️ El `revoke all on all tables in schema public` del inicio de este archivo
-- NO cubre esta tabla: se creó después. Y Supabase mantiene un
-- ALTER DEFAULT PRIVILEGES que otorga ALL a anon/authenticated sobre cada
-- tabla nueva. Sin este REVOKE explícito, anon tendría SELECT (y DELETE)
-- sobre las fichas pese a no aparecer en ningún GRANT de abajo.
revoke all on public.knowledge_embeddings from anon, authenticated;

-- Decisión 1 de la spec: la IA exige sesión iniciada. SELECT para
-- `authenticated` y NO para `anon`.
grant select on public.knowledge_embeddings to authenticated;

-- INSERT/UPDATE/DELETE: sin GRANT y sin política, a propósito. Solo el
-- cliente service_role (que bypassa RLS) escribe fichas, desde el Route
-- Handler de reindexado y el script index-all. Permitir que un usuario
-- fabrique fichas sería permitirle envenenar el contexto que lee el modelo.

create policy "knowledge_embeddings_select_authenticated" on public.knowledge_embeddings
  for select
  to authenticated
  using (true);
