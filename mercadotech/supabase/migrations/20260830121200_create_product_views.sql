-- PRODUCT_VIEWS: cada apertura de un producto es un evento propio (sin
-- contador agregado) — permite análisis temporal, no solo un total.
create table public.product_views (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  -- ON DELETE CASCADE (no explicitado): evento analítico ligado al usuario,
  -- consistente con el patrón "dueño" de la spec.
  user_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now()
);

alter table public.product_views enable row level security;

create index product_views_product_id_idx on public.product_views (product_id);
