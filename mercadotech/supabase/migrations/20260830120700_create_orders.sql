create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- ON DELETE RESTRICT (no explicitado en la spec): un pedido es un registro
  -- financiero/histórico; no se permite borrar el profile de un comprador
  -- mientras tenga pedidos (esta sesión no implementa soft-delete de cuentas).
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'pagado', 'enviado', 'entregado', 'cancelado')),
  total numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create index orders_buyer_id_idx on public.orders (buyer_id);
