-- CATEGORIES: árbol simple de categorías tecnológicas (autoreferencial).
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  -- parent_id nullable: una categoría raíz no tiene padre. ON DELETE SET NULL
  -- (no explicitado en la spec): borrar una categoría padre no debe arrastrar
  -- en cascada a sus hijas, solo las desengancha del árbol.
  parent_id uuid references public.categories (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
