-- PRODUCT_IMAGES: galería ordenable. `position` define el orden; el
-- drag & drop de la sesión 3 actualiza este campo.
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  image_path text not null,
  position integer not null default 0
);

alter table public.product_images enable row level security;

create index product_images_product_id_idx on public.product_images (product_id);
