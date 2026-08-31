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
