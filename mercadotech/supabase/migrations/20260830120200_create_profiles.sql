-- PROFILES: 1:1 con auth.users. Mismo uuid como PK y FK (on delete cascade:
-- si se borra el usuario de Auth, su profile desaparece con él).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  phone text,
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  avatar_path text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Crea automáticamente el profile cuando se registra un usuario en auth.users.
-- SECURITY DEFINER + search_path fijo: se ejecuta con privilegios del dueño
-- de la función (no del usuario que se registra), que sí puede escribir en
-- public.profiles aunque todavía no exista ninguna política RLS para INSERT.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- display_name se toma de los metadatos del signup si el cliente los
  -- envía; si no, queda NULL y el usuario lo completa después desde la UI.
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
