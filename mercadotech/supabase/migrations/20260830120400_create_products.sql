create table public.products (
  id uuid primary key default gen_random_uuid(),
  -- ON DELETE CASCADE (no explicitado en la spec): consistente con el patrón
  -- de "dueño" que la spec sí marca explícito en cart_items/favorites — si se
  -- borra la cuenta del vendedor, su catálogo se borra con ella.
  seller_id uuid not null references public.profiles (id) on delete cascade,
  -- ON DELETE RESTRICT (no explicitado): evita borrar una categoría mientras
  -- tenga productos activos; fuerza a recategorizar primero.
  category_id uuid not null references public.categories (id) on delete restrict,
  title text not null,
  description text,
  brand text,
  condition text not null default 'nuevo' check (condition in ('nuevo', 'usado', 'reacondicionado')),
  price numeric(12, 2) not null check (price > 0),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

create trigger set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create index products_seller_id_idx on public.products (seller_id);
create index products_category_id_idx on public.products (category_id);
create index products_is_active_idx on public.products (is_active);
