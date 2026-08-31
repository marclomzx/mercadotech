-- ============================================================
-- MercadoTech — datos de prueba (Fase 2.5)
--
-- Se ejecuta automáticamente después de las migraciones en cada
-- `supabase db reset`. Corre como el rol `postgres` (bypassa RLS), así que
-- todos los INSERT de abajo son directos, sin pasar por las políticas de la
-- Fase 2.3 (excepto donde se indica lo contrario).
--
-- Contraseña de laboratorio para los 6 usuarios: MercadoTech123!
-- (hasheada con pgcrypto/bcrypt al vuelo — ver sección USERS).
--
-- Convención de UUIDs fijos y legibles por prefijo, para poder referenciarlos
-- directamente en tests (sesión 6) sin tener que hacer lookups:
--   a0000000-...-0000000000NN  profiles / auth.users  (01-03 buyers, 04-05 sellers, 06 admin)
--   b0000000-...-0000000000NN  products                (01-16)
--   c0000000-...-0000000000NN  orders                  (01-07, una por cada estado + extras 'entregado')
--   d0000000-...-0000000000NN  categories              (01-08)
--   e0000000-...-0000000000NN  (sin usar — product_images usa id aleatorio, no se referencia en tests)
--   f0000000-...-0000000000NN  order_items             (01-10)
--   aa000000-...-0000000000NN  questions               (01-08)
--   ab000000-...-0000000000NN  reviews                 (01-04)
--   ac000000-...-0000000000NN  favorites               (01-08)
--   ad000000-...-0000000000NN  product_views           (01-15)
--   ae000000-...-0000000000NN  support_articles        (01-10)
--   af000000-...-0000000000NN  support_tickets         (01-02)
--   1a000000-...-0000000000NN  ticket_messages         (01-07)
--
-- GAP CONOCIDO (documentado a propósito, como en ReadHub): los `image_path`
-- de product_images apuntan a rutas coherentes con la convención del bucket
-- `product-images`, pero NINGÚN archivo real existe todavía en Storage — se
-- suben recién cuando alguien lo hace desde la UI (sesión 3). Hasta entonces,
-- esas URLs devuelven 404 si se intentan cargar directamente.

-- ============================================================
-- USERS (auth.users + auth.identities) → dispara handle_new_user → profiles
-- ============================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'buyer1@mercadotech.test', crypt('MercadoTech123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Camila Torres"}',
   false, now(), now(), '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'buyer2@mercadotech.test', crypt('MercadoTech123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Diego Huamán"}',
   false, now(), now(), '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'buyer3@mercadotech.test', crypt('MercadoTech123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Valeria Quispe"}',
   false, now(), now(), '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
   'seller1@mercadotech.test', crypt('MercadoTech123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"ElectroMax Perú"}',
   false, now(), now(), '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
   'seller2@mercadotech.test', crypt('MercadoTech123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"GamerZone Store"}',
   false, now(), now(), '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated',
   'admin@mercadotech.test', crypt('MercadoTech123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Admin MercadoTech"}',
   false, now(), now(), '', '', '', '', '', '');

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  id::text,
  id,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true, 'phone_verified', false),
  'email',
  now(), now(), now()
from auth.users
where id in (
  'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000006'
);

-- handle_new_user (Fase 2.2) ya creó los 6 profiles con role='buyer' por
-- defecto. Hace falta ASIGNAR seller/admin, pero el trigger
-- protect_profile_role (Fase 2.3) bloquea cualquier cambio de `role` que no
-- venga de un admin o del service_role — y este script corre como `postgres`
-- sin contexto de JWT, así que no cumple ninguna de las dos excepciones. Se
-- desactiva el trigger solo para este ajuste puntual del seed.
alter table public.profiles disable trigger protect_profile_role_trigger;

update public.profiles set role = 'seller', phone = '987654321'
  where id = 'a0000000-0000-0000-0000-000000000004';
update public.profiles set role = 'seller', phone = '976543210'
  where id = 'a0000000-0000-0000-0000-000000000005';
update public.profiles set role = 'admin'
  where id = 'a0000000-0000-0000-0000-000000000006';
update public.profiles set phone = '945678123' where id = 'a0000000-0000-0000-0000-000000000001';
update public.profiles set phone = '934567812' where id = 'a0000000-0000-0000-0000-000000000002';

alter table public.profiles enable trigger protect_profile_role_trigger;

-- ============================================================
-- CATEGORIES (8)
-- ============================================================

insert into public.categories (id, name, slug) values
  ('d0000000-0000-0000-0000-000000000001', 'Laptops', 'laptops'),
  ('d0000000-0000-0000-0000-000000000002', 'Smartphones', 'smartphones'),
  ('d0000000-0000-0000-0000-000000000003', 'Componentes de PC', 'componentes-de-pc'),
  ('d0000000-0000-0000-0000-000000000004', 'Audio', 'audio'),
  ('d0000000-0000-0000-0000-000000000005', 'Gaming', 'gaming'),
  ('d0000000-0000-0000-0000-000000000006', 'Monitores', 'monitores'),
  ('d0000000-0000-0000-0000-000000000007', 'Accesorios', 'accesorios'),
  ('d0000000-0000-0000-0000-000000000008', 'Redes', 'redes');

-- ============================================================
-- PRODUCTS (16) — 8 por vendedor. 2 inactivos (b...03, b...16),
-- 1 con stock 0 (b...05), para probar filtros y validación de checkout.
-- ============================================================

insert into public.products (id, seller_id, category_id, title, description, brand, condition, price, stock, is_active) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001',
   'Laptop Lenovo IdeaPad Slim 3 15.6" Ryzen 5 16GB 512GB SSD',
   'Ideal para estudios y teletrabajo: procesador Ryzen 5 fluido para multitarea, 16GB de RAM y SSD de 512GB para arranque rápido. Pantalla Full HD antirreflejo.',
   'Lenovo', 'nuevo', 2199.00, 8, true),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001',
   'Laptop HP Pavilion 15 Intel Core i5 8GB 512GB SSD',
   'Equipo versátil para oficina y uso diario, con procesador Intel Core i5 de última generación y SSD de 512GB. Incluye teclado retroiluminado y lector de huella.',
   'HP', 'nuevo', 2399.00, 5, true),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001',
   'Laptop ASUS VivoBook 14 Intel Core i3 8GB 256GB SSD (Reacondicionada)',
   'Equipo reacondicionado, probado y con garantía de 3 meses. Ligera y portátil, perfecta para tareas básicas de oficina y navegación. Batería reemplazada.',
   'ASUS', 'reacondicionado', 1349.00, 4, false),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002',
   'Smartphone Samsung Galaxy A55 5G 256GB',
   'Pantalla Super AMOLED de 6.6", cámara principal de 50MP y batería de 5000mAh. Compatible con redes 5G y liberado para cualquier operador en Perú.',
   'Samsung', 'nuevo', 1599.00, 12, true),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002',
   'Smartphone Xiaomi Redmi Note 13 Pro 256GB',
   'Cámara de 200MP con estabilización óptica, carga rápida de 67W y pantalla AMOLED a 120Hz. Uno de los más vendidos de la categoría — actualmente agotado.',
   'Xiaomi', 'nuevo', 999.00, 0, true),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003',
   'Placa Madre ASUS Prime B550M-A AM4',
   'Compatible con procesadores Ryzen serie 3000/5000, soporta hasta 128GB de RAM DDR4 y conectividad M.2 NVMe. Formato micro-ATX.',
   'ASUS', 'nuevo', 549.00, 10, true),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003',
   'Memoria RAM Kingston Fury Beast 16GB DDR4 3200MHz (Usada)',
   'Kit de memoria retirada de un equipo dado de baja, probada con MemTest86 sin errores. Funciona perfecto para actualizar un PC de gama media.',
   'Kingston', 'usado', 159.00, 6, true),
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000006',
   'Monitor LG 24" Full HD IPS 24MK430H',
   'Panel IPS con ángulos de visión amplios, tecnología AMD FreeSync y modo lectura para reducir la fatiga visual. Incluye cable HDMI.',
   'LG', 'nuevo', 649.00, 9, true),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000004',
   'Audífonos Logitech G435 Lightspeed Inalámbricos',
   'Conexión dual Bluetooth y Lightspeed 2.4GHz, hasta 18 horas de batería y diseño ultraligero de 165g. Sonido optimizado para gaming.',
   'Logitech', 'nuevo', 249.00, 20, true),
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000004',
   'Parlante JBL Flip 6 Bluetooth',
   'Sonido potente con graves profundos, resistencia al agua y polvo IP67, hasta 12 horas de reproducción. Ideal para exteriores.',
   'JBL', 'nuevo', 399.00, 14, true),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005',
   'Mouse Logitech G502 Hero Gaming',
   'Sensor HERO 25K de alta precisión, 11 botones programables y sistema de pesas ajustables. El favorito de los gamers competitivos.',
   'Logitech', 'nuevo', 179.00, 30, true),
  ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005',
   'Teclado Mecánico Redragon Kumara K552 RGB',
   'Switches mecánicos azules con retroiluminación RGB, estructura compacta TKL y construcción resistente en aluminio.',
   'Redragon', 'nuevo', 129.00, 18, true),
  ('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005',
   'Silla Gamer Cougar Armor One',
   'Reclinable hasta 180°, reposabrazos 4D y soporte lumbar ajustable. Estructura de acero que soporta hasta 120kg.',
   'Cougar', 'nuevo', 899.00, 5, true),
  ('b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000007',
   'Mochila para Laptop Targus 15.6"',
   'Compartimento acolchado para laptops de hasta 15.6", múltiples bolsillos organizadores y correas ergonómicas acolchadas.',
   'Targus', 'nuevo', 129.00, 25, true),
  ('b0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000008',
   'Router TP-Link Archer C6 AC1200 Dual Band',
   'Wi-Fi de doble banda hasta 1200Mbps, 4 antenas externas de alta ganancia y tecnología MU-MIMO para múltiples dispositivos.',
   'TP-Link', 'nuevo', 149.00, 16, true),
  ('b0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000008',
   'Repetidor WiFi TP-Link RE305 AC1200',
   'Extiende la cobertura Wi-Fi de tu hogar hasta 1200Mbps combinados. Modelo descontinuado por el fabricante, publicación pausada.',
   'TP-Link', 'nuevo', 89.00, 3, false);

-- ============================================================
-- PRODUCT_IMAGES — 2 por producto (32 filas), path =
-- product-images/{seller_id}/{product_id}/{n}.jpg (convención del bucket,
-- Fase 2.4). NINGÚN archivo real existe todavía en Storage: se suben desde
-- la UI en la sesión 3 — hasta entonces estas rutas son solo referencias.
-- ============================================================

insert into public.product_images (product_id, image_path, position)
select p.id, p.seller_id::text || '/' || p.id::text || '/' || gs.n || '.jpg', gs.n - 1
from public.products p
cross join generate_series(1, 2) as gs(n)
order by p.id, gs.n;

-- ============================================================
-- ORDERS (7) — cubre los 5 estados; 3 son 'entregado' repartidos entre
-- distintos compradores/productos para poder sembrar reseñas verificadas.
-- ============================================================

insert into public.orders (id, buyer_id, status, total, created_at) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'pendiente', 2199.00, now() - interval '1 day'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'pagado',    2097.00, now() - interval '3 days'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'enviado',    308.00, now() - interval '5 days'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'entregado',  549.00, now() - interval '14 days'),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', 'entregado', 2798.00, now() - interval '20 days'),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 'entregado',  149.00, now() - interval '10 days'),
  ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', 'cancelado',  129.00, now() - interval '7 days');

-- ============================================================
-- ORDER_ITEMS (10) — snapshots coherentes con products en el momento del
-- seed (title_snapshot/price_snapshot = valores actuales de la fila).
-- ============================================================

insert into public.order_items (id, order_id, product_id, seller_id, title_snapshot, price_snapshot, quantity) values
  ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004',
   'Laptop Lenovo IdeaPad Slim 3 15.6" Ryzen 5 16GB 512GB SSD', 2199.00, 1),
  ('f0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004',
   'Smartphone Samsung Galaxy A55 5G 256GB', 1599.00, 1),
  ('f0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000005',
   'Audífonos Logitech G435 Lightspeed Inalámbricos', 249.00, 2),
  ('f0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000005',
   'Mouse Logitech G502 Hero Gaming', 179.00, 1),
  ('f0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000005',
   'Teclado Mecánico Redragon Kumara K552 RGB', 129.00, 1),
  ('f0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000004',
   'Placa Madre ASUS Prime B550M-A AM4', 549.00, 1),
  ('f0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004',
   'Laptop HP Pavilion 15 Intel Core i5 8GB 512GB SSD', 2399.00, 1),
  ('f0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000005',
   'Parlante JBL Flip 6 Bluetooth', 399.00, 1),
  ('f0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000005',
   'Router TP-Link Archer C6 AC1200 Dual Band', 149.00, 1),
  ('f0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000005',
   'Mochila para Laptop Targus 15.6"', 129.00, 1);

-- ============================================================
-- QUESTIONS (8) — 4 respondidas, 4 sin responder.
-- ============================================================

insert into public.questions (id, product_id, user_id, question, answer, answered_at, created_at) values
  ('aa000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
   '¿Viene con Windows instalado o hay que comprarlo aparte?',
   'Viene con Windows 11 Home preinstalado y activado, sin costo adicional.', now() - interval '2 days', now() - interval '3 days'),
  ('aa000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003',
   '¿Es liberado para cualquier operador?',
   'Sí, viene liberado de fábrica y funciona con cualquier operador en Perú.', now() - interval '4 days', now() - interval '5 days'),
  ('aa000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001',
   '¿El envío a provincia tiene costo adicional?',
   'El envío a provincia se coordina con Olva Courier; el costo se calcula según destino al momento de la compra.', now() - interval '1 day', now() - interval '2 days'),
  ('aa000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002',
   '¿Trae cable HDMI incluido?',
   'Sí, incluye cable HDMI y cable de poder en la caja.', now() - interval '6 days', now() - interval '8 days'),
  ('aa000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003',
   '¿Es compatible con procesadores Ryzen 5000?', null, null, now() - interval '1 day'),
  ('aa000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001',
   '¿Cuántas horas de batería tiene en uso continuo?', null, null, now() - interval '12 hours'),
  ('aa000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000002',
   '¿Hasta cuántos kilos de peso soporta?', null, null, now() - interval '2 hours'),
  ('aa000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000003',
   '¿Este router cubre bien una casa de dos pisos?', null, null, now() - interval '3 hours');

-- ============================================================
-- REVIEWS (4) — solo sobre pedidos 'entregado' que contienen ese producto
-- (mismas condiciones que exige la política RLS de INSERT, Fase 2.3).
-- ============================================================

insert into public.reviews (id, product_id, buyer_id, order_id, rating, comment, created_at) values
  ('ab000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004',
   5, 'Excelente placa, la instalé sin problemas y corre estable con mi Ryzen 5 3600. Llegó bien empacada.', now() - interval '10 days'),
  ('ab000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005',
   4, 'Buena laptop para el precio, cumple bien para trabajo de oficina. El ventilador se escucha un poco al usar varios programas a la vez.', now() - interval '15 days'),
  ('ab000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005',
   5, 'El parlante suena increíble para su tamaño, lo uso en la playa y resistió bien la arena y el agua.', now() - interval '14 days'),
  ('ab000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000002',
   'c0000000-0000-0000-0000-000000000006', 4, 'Buena señal en toda la casa, fácil de configurar. Le bajo una estrella porque la app de configuración es algo lenta.', now() - interval '6 days');

-- ============================================================
-- FAVORITES (8) — de muestra.
-- ============================================================

insert into public.favorites (id, user_id, product_id, created_at) values
  ('ac000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', now() - interval '2 days'),
  ('ac000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000009', now() - interval '3 days'),
  ('ac000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000013', now() - interval '1 day'),
  ('ac000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', now() - interval '4 days'),
  ('ac000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000011', now() - interval '5 days'),
  ('ac000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', now() - interval '6 days'),
  ('ac000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000006', now() - interval '7 days'),
  ('ac000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000015', now() - interval '2 days');

-- ============================================================
-- PRODUCT_VIEWS (15) — de muestra.
-- ============================================================

insert into public.product_views (id, product_id, user_id, viewed_at) values
  ('ad000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now() - interval '1 day'),
  ('ad000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', now() - interval '2 days'),
  ('ad000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', now() - interval '15 days'),
  ('ad000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', now() - interval '3 hours'),
  ('ad000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', now() - interval '5 days'),
  ('ad000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', now() - interval '10 days'),
  ('ad000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', now() - interval '1 day'),
  ('ad000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000001', now() - interval '12 hours'),
  ('ad000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000003', now() - interval '14 days'),
  ('ad000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', now() - interval '2 days'),
  ('ad000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000002', now() - interval '5 days'),
  ('ad000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', now() - interval '1 day'),
  ('ad000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000002', now() - interval '6 days'),
  ('ad000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000003', now() - interval '3 days'),
  ('ad000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now() - interval '20 days');

-- ============================================================
-- SUPPORT_ARTICLES (10) — FAQ real, base del RAG de la sesión 4.
-- ============================================================

insert into public.support_articles (id, title, content, category, is_published, created_at, updated_at) values
  ('ae000000-0000-0000-0000-000000000001', '¿Cuánto tiempo tarda en llegar mi pedido?',
   'Los tiempos de entrega dependen del destino. Para pedidos dentro de Lima Metropolitana, el tiempo estimado es de 2 a 3 días hábiles desde que el vendedor confirma el envío. Para provincias, el rango habitual es de 4 a 7 días hábiles, dependiendo de la zona y el operador logístico asignado.' || chr(10) || chr(10) ||
   'El conteo de días comienza una vez que tu pedido pasa al estado "enviado", no desde el momento de la compra. Mientras el pedido está en estado "pagado", el vendedor está preparando el paquete para su despacho, lo cual normalmente toma entre 1 y 2 días hábiles adicionales.' || chr(10) || chr(10) ||
   'Si tu pedido no ha llegado dentro del rango estimado, puedes escribirnos desde la sección de soporte indicando el número de pedido para que revisemos el estado con el courier.',
   'envíos', true, now() - interval '60 days', now() - interval '60 days'),

  ('ae000000-0000-0000-0000-000000000002', '¿Cómo rastreo el estado de mi pedido?',
   'Puedes ver el estado de cualquier compra desde la sección "Mis pedidos" de tu cuenta. Cada pedido pasa por cinco estados posibles: pendiente (recién generado, esperando pago), pagado (pago confirmado, el vendedor lo está preparando), enviado (ya salió con el courier), entregado (recibido por el comprador) y cancelado.' || chr(10) || chr(10) ||
   'Cuando un pedido cambia a "enviado", el vendedor debe registrar la información de seguimiento del courier; esa información aparece en el detalle del pedido apenas esté disponible.' || chr(10) || chr(10) ||
   'Si el estado de tu pedido no cambia durante varios días seguidos, contáctanos desde soporte con el número de pedido — lo más común es una demora del courier, y lo verificamos directamente con ellos.',
   'envíos', true, now() - interval '58 days', now() - interval '58 days'),

  ('ae000000-0000-0000-0000-000000000003', 'Zonas de cobertura y costos de envío',
   'MercadoTech llega a todo el territorio nacional a través de couriers asociados como Olva Courier y Shalom. El costo de envío se calcula automáticamente en el checkout según el peso del producto, sus dimensiones y el distrito o provincia de destino — no es un monto fijo para todos los pedidos.' || chr(10) || chr(10) ||
   'En Lima Metropolitana y Callao, la mayoría de los productos livianos (accesorios, audífonos, periféricos) tienen costos de envío reducidos frente a productos grandes como laptops o monitores, que pagan una tarifa mayor por su volumen.' || chr(10) || chr(10) ||
   'Actualmente no ofrecemos recojo en tienda física: todos los pedidos se despachan por courier desde la dirección registrada por cada vendedor.',
   'envíos', true, now() - interval '55 days', now() - interval '55 days'),

  ('ae000000-0000-0000-0000-000000000004', 'Métodos de pago disponibles',
   'En MercadoTech puedes pagar con tarjetas de crédito o débito Visa y Mastercard, además de las billeteras digitales más usadas en Perú: Yape y Plin. El método elegido se procesa de forma simulada en este entorno de práctica — no se realizan cargos reales.' || chr(10) || chr(10) ||
   'Para pagos con tarjeta, el cargo se refleja de inmediato y el pedido pasa automáticamente al estado "pagado". Con Yape o Plin, deberás confirmar la operación desde tu app antes de que el pedido cambie de estado.' || chr(10) || chr(10) ||
   'No se guarda ningún dato de tarjeta en nuestros servidores: toda la información de pago se procesa a través de un proveedor externo especializado.',
   'pagos', true, now() - interval '50 days', now() - interval '50 days'),

  ('ae000000-0000-0000-0000-000000000005', '¿Es seguro comprar y pagar en MercadoTech?',
   'Sí. Todas las conexiones a la plataforma están cifradas, y los pagos con tarjeta se procesan mediante un proveedor externo certificado — nunca almacenamos el número completo de tu tarjeta en nuestros servidores.' || chr(10) || chr(10) ||
   'Además, cada vendedor pasa por un proceso de verificación antes de poder publicar productos, y contamos con un sistema de reseñas verificadas: solo los compradores que efectivamente recibieron el producto pueden calificarlo, lo que reduce reseñas falsas.' || chr(10) || chr(10) ||
   'Si detectas actividad sospechosa en tu cuenta o un producto que no corresponde a lo publicado, repórtalo de inmediato desde soporte para que el equipo de moderación lo revise.',
   'pagos', true, now() - interval '48 days', now() - interval '48 days'),

  ('ae000000-0000-0000-0000-000000000006', '¿Puedo pagar en cuotas?',
   'El pago en cuotas depende de tu tarjeta de crédito y del banco emisor, no de MercadoTech directamente: nosotros mostramos la opción de cuotas cuando el proveedor de pagos la ofrece para tu tarjeta y el monto de la compra.' || chr(10) || chr(10) ||
   'Las tasas de interés y comisiones por diferir el pago las define tu banco, no la plataforma. Te recomendamos revisar las condiciones exactas en tu app o estado de cuenta antes de confirmar la compra en cuotas.' || chr(10) || chr(10) ||
   'Los pagos con Yape o Plin no admiten cuotas: siempre se procesan al contado.',
   'pagos', true, now() - interval '45 days', now() - interval '45 days'),

  ('ae000000-0000-0000-0000-000000000007', 'Política de devoluciones y cambios',
   'Tienes hasta 7 días calendario desde que recibes tu pedido para solicitar una devolución o cambio, siempre que el producto esté en las mismas condiciones en que llegó: sin uso, con su empaque y accesorios originales.' || chr(10) || chr(10) ||
   'Los productos publicados como "usado" tienen condiciones distintas: solo se aceptan devoluciones si el artículo llega con un defecto no informado en la publicación, no por simple arrepentimiento.' || chr(10) || chr(10) ||
   'Para iniciar el proceso, ve a "Mis pedidos", selecciona el pedido entregado y toca "Solicitar devolución". El vendedor tiene un plazo de 2 días hábiles para responder tu solicitud.' || chr(10) || chr(10) ||
   'Los gastos de envío de la devolución corren por cuenta del comprador, salvo que el motivo sea un producto defectuoso o distinto al publicado, en cuyo caso los cubre el vendedor.',
   'devoluciones', true, now() - interval '40 days', now() - interval '40 days'),

  ('ae000000-0000-0000-0000-000000000008', '¿Cómo solicito un reembolso?',
   'El reembolso se genera automáticamente una vez que el vendedor acepta tu solicitud de devolución, o cuando soporte resuelve una disputa a tu favor. No necesitas hacer un trámite aparte para pedirlo.' || chr(10) || chr(10) ||
   'El dinero se devuelve al mismo método de pago que usaste en la compra: si pagaste con tarjeta, el abono lo procesa tu banco y puede demorar entre 5 y 10 días hábiles en reflejarse, dependiendo de la entidad. Con Yape o Plin, el reembolso suele verse reflejado en 1 a 2 días hábiles.' || chr(10) || chr(10) ||
   'Puedes revisar el estado de tu reembolso desde el detalle del pedido, en la sección "Mis pedidos".',
   'devoluciones', true, now() - interval '38 days', now() - interval '38 days'),

  ('ae000000-0000-0000-0000-000000000009', '¿Cómo actualizo mis datos de cuenta o mi contraseña?',
   'Puedes editar tu nombre visible, teléfono y foto de perfil desde la sección "Mi cuenta". Los cambios se guardan de inmediato y no requieren confirmación adicional.' || chr(10) || chr(10) ||
   'Para cambiar tu contraseña, usa la opción "¿Olvidaste tu contraseña?" en la pantalla de inicio de sesión: te enviaremos un enlace a tu correo registrado para crear una nueva. Por seguridad, no es posible ver ni recuperar tu contraseña actual.' || chr(10) || chr(10) ||
   'Si necesitas cambiar el correo asociado a tu cuenta, escríbenos desde soporte — por seguridad este cambio requiere una verificación adicional.',
   'cuenta', true, now() - interval '35 days', now() - interval '35 days'),

  ('ae000000-0000-0000-0000-000000000010', '¿Cómo me convierto en vendedor en MercadoTech?',
   'Cualquier usuario registrado puede solicitar convertirse en vendedor escribiendo a soporte con sus datos básicos. El equipo revisa la solicitud y, si es aprobada, tu cuenta pasa a tener el rol de vendedor, habilitando el panel para publicar productos.' || chr(10) || chr(10) ||
   'Como vendedor podrás publicar productos con fotos, precio y stock, gestionar tu inventario, responder preguntas de compradores y hacer seguimiento a los pedidos que contengan tus productos.' || chr(10) || chr(10) ||
   'El proceso de revisión suele tomar hasta 2 días hábiles. Una vez aprobado, ya puedes publicar tu primer producto desde tu panel de vendedor.',
   'cuenta', true, now() - interval '30 days', now() - interval '30 days');

-- ============================================================
-- SUPPORT_TICKETS (2) + TICKET_MESSAGES (7)
-- ============================================================

insert into public.support_tickets (id, user_id, subject, status, channel, created_at) values
  ('af000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
   'Mi pedido no ha llegado', 'en_proceso', 'chat', now() - interval '2 days'),
  ('af000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003',
   '¿Puedo cambiar la dirección de envío de un pedido pendiente?', 'resuelto', 'chat', now() - interval '6 days');

insert into public.ticket_messages (id, ticket_id, sender_role, content, created_at) values
  ('1a000000-0000-0000-0000-000000000001', 'af000000-0000-0000-0000-000000000001', 'usuario',
   'Hola, hice un pedido hace 5 días y todavía no me llega. ¿Pueden ayudarme?', now() - interval '2 days'),
  ('1a000000-0000-0000-0000-000000000002', 'af000000-0000-0000-0000-000000000001', 'agente',
   'Hola Diego, gracias por escribirnos. Voy a revisar el estado de tu pedido, dame un momento por favor.', now() - interval '2 days' + interval '2 minutes'),
  ('1a000000-0000-0000-0000-000000000003', 'af000000-0000-0000-0000-000000000001', 'agente',
   'He revisado tu pedido y veo que está en tránsito con el courier. El tiempo estimado de entrega para tu zona es de 3 a 5 días hábiles adicionales.', now() - interval '2 days' + interval '5 minutes'),
  ('1a000000-0000-0000-0000-000000000004', 'af000000-0000-0000-0000-000000000001', 'humano',
   'Hola Diego, soy Rocío del equipo de soporte. Confirmo lo indicado: tu pedido está en camino. Si no llega en la fecha estimada, escríbenos aquí nuevamente y gestionamos un reembolso o reenvío.', now() - interval '1 day'),
  ('1a000000-0000-0000-0000-000000000005', 'af000000-0000-0000-0000-000000000002', 'usuario',
   'Buenas, necesito cambiar la dirección de entrega de un pedido que todavía no ha sido enviado. ¿Es posible?', now() - interval '6 days'),
  ('1a000000-0000-0000-0000-000000000006', 'af000000-0000-0000-0000-000000000002', 'agente',
   'Sí, mientras tu pedido esté en estado "pendiente" o "pagado" puedes solicitar el cambio de dirección escribiéndonos aquí con el número de pedido.', now() - interval '6 days' + interval '3 minutes'),
  ('1a000000-0000-0000-0000-000000000007', 'af000000-0000-0000-0000-000000000002', 'humano',
   'Hola Valeria, ya actualicé la dirección de envío de tu pedido. Cualquier otra consulta, aquí estamos.', now() - interval '5 days');

-- ============================================================
-- RESUMEN
-- ============================================================
--
-- Tabla              | Filas
-- --------------------+-------
-- auth.users          | 6  (3 buyers, 2 sellers, 1 admin)
-- auth.identities     | 6
-- profiles            | 6  (vía trigger handle_new_user)
-- categories          | 8
-- products            | 16 (2 inactivos: b...03, b...16 · 1 con stock 0: b...05)
-- product_images      | 32 (2 por producto)
-- orders              | 7  (1 pendiente, 1 pagado, 1 enviado, 3 entregado, 1 cancelado)
-- order_items         | 10
-- questions           | 8  (4 respondidas, 4 sin responder)
-- reviews             | 4  (todas sobre pedidos 'entregado')
-- favorites           | 8
-- product_views       | 15
-- support_articles    | 10 (3 envíos, 3 pagos, 2 devoluciones, 2 cuenta)
-- support_tickets     | 2
-- ticket_messages     | 7
--
-- Credenciales (contraseña única de laboratorio): MercadoTech123!
--
--   buyer1@mercadotech.test   — Camila Torres   — buyer
--   buyer2@mercadotech.test   — Diego Huamán    — buyer
--   buyer3@mercadotech.test   — Valeria Quispe  — buyer
--   seller1@mercadotech.test — ElectroMax Perú — seller (productos b...01-08)
--   seller2@mercadotech.test — GamerZone Store — seller (productos b...09-16)
--   admin@mercadotech.test   — Admin MercadoTech — admin
