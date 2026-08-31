-- Trigger reutilizable para mantener `updated_at` al día en cada UPDATE.
-- La spec lista la columna en products y support_articles pero no describe
-- cómo se actualiza; sin este trigger la columna quedaría congelada en su
-- valor de inserción, lo cual sería un bug silencioso.
create function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
