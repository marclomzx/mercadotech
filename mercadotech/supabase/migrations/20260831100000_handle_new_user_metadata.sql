-- Reemplaza handle_new_user (Fase 2.2) para que lea `display_name` y `role`
-- desde new.raw_user_meta_data — los metadatos que el cliente envía en
-- `options.data` del signUp.
--
-- POR QUÉ EL ROL SOLO PUEDE FIJARSE AQUÍ, EN EL INSERT DEL TRIGGER:
-- El trigger protect_profile_role_trigger (Fase 2.3) es BEFORE UPDATE sobre
-- public.profiles y lanza excepción si `new.role is distinct from old.role`
-- salvo que el caller sea admin o service_role. Un usuario recién registrado
-- es 'buyer' y actúa con su propio JWT `authenticated`, así que NO cumple
-- ninguna de las dos excepciones: cualquier `update profiles set role=...`
-- desde el cliente falla siempre. Como protect_profile_role es BEFORE UPDATE
-- (no BEFORE INSERT), no interviene en esta inserción — y esta función es
-- SECURITY DEFINER, así que escribe con privilegios de su dueño. Por eso el
-- INSERT de este trigger es el ÚNICO momento del ciclo de vida de la cuenta
-- en que `role` puede quedar establecido desde el registro.
--
-- No se edita el archivo original de la Fase 2.2: se reemplaza la función
-- desde esta migración nueva con `create or replace`. El trigger
-- on_auth_user_created sigue apuntando a la misma función por nombre, así
-- que no hace falta recrearlo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    -- Si el signup no manda display_name (o manda cadena vacía), se usa el
    -- prefijo del email como nombre visible inicial.
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(new.email, '@', 1)
    ),
    -- Allow-list estricta: SOLO 'buyer' o 'seller'. Cualquier otro valor
    -- (incluido 'admin', un rol inventado, o la ausencia del campo) cae a
    -- 'buyer'. raw_user_meta_data lo controla el cliente y es manipulable
    -- desde DevTools, así que jamás se confía en él: nunca se puede obtener
    -- 'admin' desde el registro. El rol admin solo se asigna server-side
    -- (service role) o por otro admin.
    case
      when new.raw_user_meta_data ->> 'role' in ('buyer', 'seller')
        then new.raw_user_meta_data ->> 'role'
      else 'buyer'
    end
  );
  return new;
end;
$$;
