import { describe, expect, it } from "vitest";

import { cancelIfPending, checkout, getOrderById, listMyOrders } from "@/services/order.service";
import { fail, mockSupabase, pgError } from "@/services/test-utils/supabase-mock";

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "o1",
    buyer_id: "u1",
    status: "pendiente",
    total: "1500.00",
    created_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

describe("checkout", () => {
  it("llama al RPC create_order_from_cart con p_buyer_id y devuelve el id del pedido", async () => {
    const supabase = mockSupabase({ rpc: { create_order_from_cart: "o-nuevo" } });

    const orderId = await checkout("u1", supabase);

    expect(orderId).toBe("o-nuevo");
    expect(supabase.rpcCalls()).toEqual([
      { fn: "create_order_from_cart", args: { p_buyer_id: "u1" } },
    ]);
  });

  it("nunca inserta directo en orders: el único camino es el RPC", async () => {
    const supabase = mockSupabase({ rpc: { create_order_from_cart: "o-nuevo" } });

    await checkout("u1", supabase);

    expect(supabase.callsFor("orders")).toEqual([]);
  });

  it("propaga el MENSAJE del error de Postgres tal cual (stock insuficiente)", async () => {
    const supabase = mockSupabase({
      rpc: {
        create_order_from_cart: fail(
          pgError('Stock insuficiente para "Laptop Gamer Pro 15"', "P0001"),
        ),
      },
    });

    await expect(checkout("u1", supabase)).rejects.toMatchObject({
      message: 'Stock insuficiente para "Laptop Gamer Pro 15"',
      code: "P0001",
    });
  });
});

describe("listMyOrders", () => {
  it("filtra por buyer_id, ordena por fecha descendente y convierte total a number", async () => {
    const supabase = mockSupabase({
      orders: [orderRow({ total: "1500.00" }), orderRow({ id: "o2", total: "89.50" })],
    });

    const orders = await listMyOrders("u1", supabase);

    expect(orders.map((order) => order.total)).toEqual([1500, 89.5]);
    expect(supabase.filters("orders")).toEqual([
      { method: "eq", args: ["buyer_id", "u1"] },
      { method: "order", args: ["created_at", { ascending: false }] },
    ]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ orders: fail(pgError("denied", "42501")) });

    await expect(listMyOrders("u1", supabase)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("getOrderById", () => {
  it("separa el pedido de sus ítems y convierte los numeric de ambos", async () => {
    const supabase = mockSupabase({
      orders: {
        maybeSingle: orderRow({
          order_items: [
            { id: "i1", order_id: "o1", quantity: 2, price_snapshot: "750.00" },
            { id: "i2", order_id: "o1", quantity: 1, price_snapshot: "89.50" },
          ],
        }),
      },
    });

    const result = await getOrderById("o1", supabase);

    expect(result?.order.total).toBe(1500);
    expect(result?.order).not.toHaveProperty("order_items");
    expect(result?.items.map((item) => item.price_snapshot)).toEqual([750, 89.5]);
  });

  // Comportamiento real: un pedido ajeno no da error de permisos — la RLS lo
  // hace invisible y maybeSingle devuelve null.
  it("devuelve null cuando el pedido no es visible, sin lanzar", async () => {
    const supabase = mockSupabase({ orders: { maybeSingle: null } });

    await expect(getOrderById("ajeno", supabase)).resolves.toBeNull();
  });

  it("busca por id sin filtrar por buyer_id (la RLS ya restringe)", async () => {
    const supabase = mockSupabase({ orders: { maybeSingle: null } });

    await getOrderById("o1", supabase);

    expect(supabase.filters("orders")).toEqual([{ method: "eq", args: ["id", "o1"] }]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ orders: fail(pgError("boom")) });

    await expect(getOrderById("o1", supabase)).rejects.toMatchObject({ message: "boom" });
  });
});

describe("cancelIfPending", () => {
  it("filtra por status = 'pendiente' además del id (espeja la política RLS)", async () => {
    const supabase = mockSupabase({
      orders: { maybeSingle: orderRow({ status: "cancelado" }) },
    });

    const order = await cancelIfPending("o1", supabase);

    expect(supabase.updates("orders")).toEqual([{ status: "cancelado" }]);
    expect(supabase.filters("orders")).toEqual([
      { method: "eq", args: ["id", "o1"] },
      { method: "eq", args: ["status", "pendiente"] },
    ]);
    expect(order?.status).toBe("cancelado");
    expect(order?.total).toBe(1500);
  });

  // Comportamiento real: cancelar un pedido ya avanzado no lanza — no matchea
  // ninguna fila y devuelve null. El caller decide cómo comunicarlo.
  it("devuelve null cuando el pedido ya avanzó de 'pendiente'", async () => {
    const supabase = mockSupabase({ orders: { maybeSingle: null } });

    await expect(cancelIfPending("o1", supabase)).resolves.toBeNull();
  });

  it("no toca products: cancelar NO repone stock", async () => {
    const supabase = mockSupabase({ orders: { maybeSingle: orderRow() } });

    await cancelIfPending("o1", supabase);

    expect(supabase.callsFor("products")).toEqual([]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ orders: { update: fail(pgError("denied", "42501")) } });

    await expect(cancelIfPending("o1", supabase)).rejects.toMatchObject({ code: "42501" });
  });
});
