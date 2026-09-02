-- ============================================================
-- MercadoTech — seed de PRODUCCIÓN (Fase 7.4)
--
-- Este archivo NO es el seed de laboratorio. `supabase/seed.sql` (Fase 2.5)
-- corre en cada `supabase db reset` local y contiene datos falsos que JAMÁS
-- pueden llegar a un entorno público:
--
--   - 6 usuarios de laboratorio, insertados directo en `auth.users`, con una
--     contraseña compartida y escrita en claro en ese archivo;
--   - 16 productos inventados con precios y stock ficticios;
--   - pedidos, reseñas, preguntas, favoritos y tickets de mentira.
--
-- Nada de eso se siembra acá (decisión 6 de MercadoTech_sesion7.md). En
-- producción los usuarios se registran de verdad por la UI, y el catálogo
-- nace VACÍO a propósito: hasta que un vendedor real publique su primer
-- producto, la home muestra el `EmptyState` — eso es el comportamiento
-- esperado, no un bug.
--
-- Lo único que SÍ se siembra es contenido real, que no depende de ningún
-- usuario y que la aplicación necesita para funcionar desde el minuto cero:
--
--   1. Las 8 CATEGORÍAS del catálogo. Son la taxonomía del sitio: sin ellas
--      el formulario de publicar producto no tiene de dónde elegir y las
--      rutas /categoria/[slug] no resuelven.
--   2. Los 10 ARTÍCULOS de la FAQ (`support_articles`). Son la base de
--      conocimiento del RAG: /soporte responde CITÁNDOLOS. Están escritos
--      como contenido real de producto (envíos, pagos, devoluciones,
--      cuenta), así que se reutilizan tal cual desde el seed de laboratorio.
--
-- Cómo se ejecuta (paso 3 de la Fase 7.4): se pega en el SQL Editor del
-- dashboard de Supabase del proyecto de producción y se corre UNA vez. No lo
-- ejecuta la CLI: `supabase db push` solo aplica migraciones, nunca seeds.
--
-- IMPORTANTE — después de correr esto hace falta el paso 4: los artículos
-- quedan en la base pero SIN sus embeddings, y sin embeddings /soporte
-- responde "no encontré información". Hay que correr `scripts/index-all.ts`
-- una vez apuntando a producción (decisión 7) para generar las 10 fichas en
-- `knowledge_embeddings`.
--
-- Es idempotente: `on conflict (id) do nothing` en ambos bloques, así que
-- volver a ejecutarlo no duplica nada ni pisa ediciones posteriores.
--
-- Las fechas relativas (`now() - interval 'N days'`) se conservan del seed
-- original para que la FAQ tenga un orden de publicación estable y no salgan
-- los 10 artículos con el mismo timestamp al segundo.
-- ============================================================

-- ============================================================
-- CATEGORIES (8) — taxonomía del catálogo
-- ============================================================

insert into public.categories (id, name, slug) values
  ('d0000000-0000-0000-0000-000000000001', 'Laptops', 'laptops'),
  ('d0000000-0000-0000-0000-000000000002', 'Smartphones', 'smartphones'),
  ('d0000000-0000-0000-0000-000000000003', 'Componentes de PC', 'componentes-de-pc'),
  ('d0000000-0000-0000-0000-000000000004', 'Audio', 'audio'),
  ('d0000000-0000-0000-0000-000000000005', 'Gaming', 'gaming'),
  ('d0000000-0000-0000-0000-000000000006', 'Monitores', 'monitores'),
  ('d0000000-0000-0000-0000-000000000007', 'Accesorios', 'accesorios'),
  ('d0000000-0000-0000-0000-000000000008', 'Redes', 'redes')
on conflict (id) do nothing;

-- ============================================================
-- SUPPORT_ARTICLES (10) — FAQ real, base de conocimiento del RAG
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
   'cuenta', true, now() - interval '30 days', now() - interval '30 days')
on conflict (id) do nothing;
