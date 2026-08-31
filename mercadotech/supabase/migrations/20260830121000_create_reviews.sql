-- REVIEWS: reseñas verificadas — solo de quien compró (lo valida la política
-- RLS de INSERT en la Fase 2.3 con un EXISTS sobre orders + order_items).
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  -- ON DELETE CASCADE en buyer_id/order_id (no explicitado): consistente con
  -- el patrón "dueño"; sin el comprador o sin el pedido que la verifica, la
  -- reseña deja de tener base y se elimina con ellos.
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  -- Una reseña por comprador y producto.
  unique (product_id, buyer_id)
);

alter table public.reviews enable row level security;

create index reviews_product_id_idx on public.reviews (product_id);
