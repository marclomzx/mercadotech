-- Copia de referencia del esquema completo. NO es la fuente de verdad: la
-- fuente de verdad son las migraciones en supabase/migrations/, aplicadas en
-- orden con `supabase db reset`. Este archivo se regenera a mano cada vez
-- que se agrega una migración nueva, solo para lectura rápida del esquema.
--
-- Las políticas RLS (Fase 2.3) viven en supabase/policies.sql, no aquí.

-- ============================================================
-- Extensiones
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- Funciones auxiliares
-- ============================================================

-- Mantiene `updated_at` al día en cada UPDATE (products, support_articles).
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

-- ============================================================
-- PROFILES — 1:1 con auth.users
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  phone text,
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  avatar_path text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Versión vigente tras 20260831100000_handle_new_user_metadata.sql (Fase 3.3):
-- lee display_name y role de raw_user_meta_data. `role` con allow-list
-- estricta (buyer/seller); cualquier otro valor cae a 'buyer' — nunca se
-- puede obtener 'admin' desde el registro. Es el ÚNICO punto donde `role`
-- puede fijarse: protect_profile_role_trigger (más abajo) bloquea todo
-- UPDATE posterior del propio usuario sobre esa columna.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(new.email, '@', 1)
    ),
    case
      when new.raw_user_meta_data ->> 'role' in ('buyer', 'seller')
        then new.raw_user_meta_data ->> 'role'
      else 'buyer'
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- CATEGORIES — árbol simple, autoreferencial
-- ============================================================

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  parent_id uuid references public.categories (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

-- ============================================================
-- PRODUCTS
-- ============================================================

create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
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

-- ============================================================
-- PRODUCT_IMAGES — galería ordenable
-- ============================================================

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  image_path text not null,
  position integer not null default 0
);

alter table public.product_images enable row level security;

create index product_images_product_id_idx on public.product_images (product_id);

-- ============================================================
-- CART_ITEMS — carrito persistente por usuario
-- ============================================================

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

alter table public.cart_items enable row level security;

create index cart_items_user_id_idx on public.cart_items (user_id);

-- ============================================================
-- ORDERS
-- ============================================================

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'pagado', 'enviado', 'entregado', 'cancelado')),
  total numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create index orders_buyer_id_idx on public.orders (buyer_id);

-- ============================================================
-- ORDER_ITEMS — snapshot inmutable de título y precio
-- ============================================================

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  seller_id uuid references public.profiles (id) on delete set null,
  title_snapshot text not null,
  price_snapshot numeric(12, 2) not null,
  quantity integer not null check (quantity > 0)
);

alter table public.order_items enable row level security;

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_seller_id_idx on public.order_items (seller_id);

-- ============================================================
-- QUESTIONS — preguntas y respuestas públicas
-- ============================================================

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  question text not null,
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.questions enable row level security;

create index questions_product_id_idx on public.questions (product_id);

-- ============================================================
-- REVIEWS — reseñas verificadas (solo de quien compró)
-- ============================================================

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (product_id, buyer_id)
);

alter table public.reviews enable row level security;

create index reviews_product_id_idx on public.reviews (product_id);

-- ============================================================
-- FAVORITES
-- ============================================================

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

alter table public.favorites enable row level security;

create index favorites_user_id_idx on public.favorites (user_id);

-- ============================================================
-- PRODUCT_VIEWS — cada apertura es un evento, sin contador
-- ============================================================

create table public.product_views (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now()
);

alter table public.product_views enable row level security;

create index product_views_product_id_idx on public.product_views (product_id);

-- ============================================================
-- SUPPORT_ARTICLES — base de conocimiento (FAQ), fuente del RAG (sesión 4)
-- ============================================================

create table public.support_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_articles enable row level security;

create trigger set_updated_at
  before update on public.support_articles
  for each row execute function public.set_updated_at();

-- ============================================================
-- SUPPORT_TICKETS + TICKET_MESSAGES
-- ============================================================

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  status text not null default 'abierto'
    check (status in ('abierto', 'en_proceso', 'resuelto', 'cerrado')),
  channel text not null default 'chat' check (channel in ('chat', 'voz')),
  created_at timestamptz not null default now()
);

alter table public.support_tickets enable row level security;

create index support_tickets_user_id_idx on public.support_tickets (user_id);

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_role text not null check (sender_role in ('usuario', 'agente', 'humano')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.ticket_messages enable row level security;

create index ticket_messages_ticket_id_idx on public.ticket_messages (ticket_id);

-- ============================================================
-- Checkout transaccional
-- ============================================================

create function public.create_order_from_cart(p_buyer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total numeric(12, 2) := 0;
  v_has_items boolean := false;
  v_item record;
begin
  if p_buyer_id is distinct from auth.uid() then
    raise exception 'No autorizado: p_buyer_id debe coincidir con el usuario autenticado';
  end if;

  for v_item in
    select
      ci.product_id,
      ci.quantity,
      p.stock,
      p.is_active,
      p.title,
      p.price,
      p.seller_id
    from cart_items ci
    join products p on p.id = ci.product_id
    where ci.user_id = p_buyer_id
    for update of p
  loop
    v_has_items := true;

    if not v_item.is_active then
      raise exception 'El producto "%" ya no está disponible', v_item.title;
    end if;

    if v_item.stock < v_item.quantity then
      raise exception 'Stock insuficiente para "%": disponible %, solicitado %',
        v_item.title, v_item.stock, v_item.quantity;
    end if;

    v_total := v_total + (v_item.price * v_item.quantity);
  end loop;

  if not v_has_items then
    raise exception 'El carrito está vacío';
  end if;

  insert into orders (buyer_id, status, total)
  values (p_buyer_id, 'pendiente', v_total)
  returning id into v_order_id;

  insert into order_items (order_id, product_id, seller_id, title_snapshot, price_snapshot, quantity)
  select v_order_id, p.id, p.seller_id, p.title, p.price, ci.quantity
  from cart_items ci
  join products p on p.id = ci.product_id
  where ci.user_id = p_buyer_id;

  update products p
  set stock = p.stock - ci.quantity
  from cart_items ci
  where p.id = ci.product_id
    and ci.user_id = p_buyer_id;

  delete from cart_items where user_id = p_buyer_id;

  return v_order_id;
end;
$$;

revoke execute on function public.create_order_from_cart(uuid) from public;
revoke execute on function public.create_order_from_cart(uuid) from anon;
grant execute on function public.create_order_from_cart(uuid) to authenticated;
