-- Checkout transaccional: lee el carrito del comprador, valida stock/estado
-- con bloqueo de fila (evita que dos checkouts simultáneos vendan el mismo
-- stock dos veces), crea el pedido con sus snapshots, descuenta stock y
-- vacía el carrito. Todo en una sola transacción implícita de la función:
-- cualquier excepción revierte todo lo hecho hasta ese punto.
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
  -- La función es SECURITY DEFINER (corre con privilegios del dueño, no del
  -- caller), así que valida ella misma que el comprador solicitado sea el
  -- usuario autenticado — nunca confía en que el cliente mande el uuid correcto.
  if p_buyer_id is distinct from auth.uid() then
    raise exception 'No autorizado: p_buyer_id debe coincidir con el usuario autenticado';
  end if;

  -- FOR UPDATE OF p bloquea las filas de products involucradas mientras dura
  -- la transacción: si otro checkout intenta tocar el mismo producto en
  -- paralelo, espera hasta que esta transacción termine (commit o rollback).
  -- Se valida stock/estado en la misma pasada, con las filas ya bloqueadas.
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

  -- title_snapshot/price_snapshot capturan el producto tal como estaba en
  -- el momento de la compra: si el vendedor lo edita después, este pedido
  -- histórico no cambia.
  insert into order_items (order_id, product_id, seller_id, title_snapshot, price_snapshot, quantity)
  select v_order_id, p.id, p.seller_id, p.title, p.price, ci.quantity
  from cart_items ci
  join products p on p.id = ci.product_id
  where ci.user_id = p_buyer_id;

  -- Los productos siguen bloqueados desde el FOR UPDATE del loop de arriba:
  -- este descuento es seguro frente a carreras concurrentes.
  update products p
  set stock = p.stock - ci.quantity
  from cart_items ci
  where p.id = ci.product_id
    and ci.user_id = p_buyer_id;

  delete from cart_items where user_id = p_buyer_id;

  return v_order_id;
end;
$$;

-- Nadie puede llamar la función directamente salvo usuarios autenticados: el
-- checkout no está disponible para anónimos, y la validación de auth.uid()
-- de arriba impide que un usuario haga checkout a nombre de otro.
revoke execute on function public.create_order_from_cart(uuid) from public;
revoke execute on function public.create_order_from_cart(uuid) from anon;
grant execute on function public.create_order_from_cart(uuid) to authenticated;
