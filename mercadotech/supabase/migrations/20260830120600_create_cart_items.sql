-- CART_ITEMS: carrito persistente por usuario.
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  -- Un producto aparece una sola vez por carrito: agregar el mismo producto
  -- de nuevo debe sumar cantidad (upsert), no crear una fila duplicada.
  unique (user_id, product_id)
);

alter table public.cart_items enable row level security;

create index cart_items_user_id_idx on public.cart_items (user_id);
