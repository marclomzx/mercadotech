-- ORDER_ITEMS: snapshot inmutable de título y precio en el momento de la
-- compra — si el vendedor edita el producto después, el pedido histórico
-- no cambia. seller_id está denormalizado para que las políticas RLS del
-- vendedor (Fase 2.3) no tengan que hacer join hasta products en caliente.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  -- product_id/seller_id nullable + ON DELETE SET NULL (no explicitado): son
  -- referencias de conveniencia, no la fuente de verdad del pedido — esa es
  -- title_snapshot/price_snapshot. Borrar el producto o el vendedor no debe
  -- destruir el historial de la compra.
  product_id uuid references public.products (id) on delete set null,
  seller_id uuid references public.profiles (id) on delete set null,
  title_snapshot text not null,
  price_snapshot numeric(12, 2) not null,
  quantity integer not null check (quantity > 0)
);

alter table public.order_items enable row level security;

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_seller_id_idx on public.order_items (seller_id);
