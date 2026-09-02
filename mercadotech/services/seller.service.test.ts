import { describe, expect, it } from "vitest";

import {
  PRODUCT_HAS_SALES_MESSAGE,
  createProduct,
  deleteProduct,
  listMyOrders,
  listMyProducts,
  toggleActive,
  updateProduct,
  updateOrderStatus,
} from "@/services/seller.service";
import { fail, mockSupabase, ok, pgError } from "@/services/test-utils/supabase-mock";

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    seller_id: "s1",
    category_id: "cat1",
    title: "Laptop",
    description: null,
    brand: null,
    condition: "nuevo",
    price: "1500.00",
    stock: 5,
    is_active: true,
    created_at: "2026-09-01T10:00:00Z",
    product_images: [],
    reviews: [],
    ...overrides,
  };
}

function itemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "i1",
    order_id: "o1",
    product_id: "p1",
    seller_id: "s1",
    quantity: 2,
    price_snapshot: "100.00",
    orders: {
      id: "o1",
      buyer_id: "u1",
      status: "pagado",
      total: "500.00",
      created_at: "2026-09-01T10:00:00Z",
    },
    ...overrides,
  };
}

describe("listMyProducts", () => {
  it("filtra por seller_id SIN filtrar is_active: el vendedor ve también los pausados", async () => {
    const supabase = mockSupabase({
      products: [productRow(), productRow({ id: "p2", is_active: false })],
    });

    const products = await listMyProducts("s1", supabase);

    expect(products.map((product) => product.is_active)).toEqual([true, false]);
    expect(supabase.filters("products")).toEqual([
      { method: "eq", args: ["seller_id", "s1"] },
      { method: "order", args: ["created_at", { ascending: false }] },
    ]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ products: fail(pgError("denied", "42501")) });

    await expect(listMyProducts("s1", supabase)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("createProduct / updateProduct / toggleActive", () => {
  const payload = {
    title: "Laptop",
    description: "desc",
    brand: "Acme",
    categoryId: "cat1",
    condition: "nuevo" as const,
    price: 1500,
    stock: 5,
  };

  it("createProduct manda seller_id y mapea categoryId → category_id", async () => {
    const supabase = mockSupabase({ products: { single: productRow() } });

    const product = await createProduct("s1", payload, supabase);

    expect(supabase.inserts("products")).toEqual([
      {
        seller_id: "s1",
        category_id: "cat1",
        title: "Laptop",
        description: "desc",
        brand: "Acme",
        condition: "nuevo",
        price: 1500,
        stock: 5,
      },
    ]);
    expect(product.price).toBe(1500);
  });

  it("updateProduct no reenvía seller_id (no es editable) y filtra por id", async () => {
    const supabase = mockSupabase({ products: { single: productRow() } });

    await updateProduct("p1", payload, supabase);

    expect(supabase.updates("products")[0]).not.toHaveProperty("seller_id");
    expect(supabase.filters("products")).toContainEqual({ method: "eq", args: ["id", "p1"] });
  });

  it("toggleActive envía el valor recibido", async () => {
    const supabase = mockSupabase({ products: ok() });

    await toggleActive("p1", false, supabase);

    expect(supabase.updates("products")).toEqual([{ is_active: false }]);
  });

  it.each([
    ["createProduct", () => createProduct("s1", payload, mockSupabase({ products: fail(pgError("denied")) }))],
    ["updateProduct", () => updateProduct("p1", payload, mockSupabase({ products: fail(pgError("denied")) }))],
    ["toggleActive", () => toggleActive("p1", true, mockSupabase({ products: fail(pgError("denied")) }))],
  ])("%s propaga el error", async (_name, run) => {
    await expect(run()).rejects.toMatchObject({ message: "denied" });
  });
});

describe("deleteProduct", () => {
  it("bloquea el borrado si el producto tiene ventas, ANTES de intentar borrar", async () => {
    const supabase = mockSupabase({ order_items: ok(null, 3) });

    await expect(deleteProduct("p1", supabase)).rejects.toThrow(PRODUCT_HAS_SALES_MESSAGE);
    expect(supabase.deletes("products")).toBe(0);
  });

  it("borra cuando no hay ventas", async () => {
    const supabase = mockSupabase({ order_items: ok(null, 0), products: ok() });

    await deleteProduct("p1", supabase);

    expect(supabase.deletes("products")).toBe(1);
    expect(supabase.filters("products")).toContainEqual({ method: "eq", args: ["id", "p1"] });
  });

  it("count null (head sin resultado) se trata como 'sin ventas'", async () => {
    const supabase = mockSupabase({ order_items: ok(null, null), products: ok() });

    await deleteProduct("p1", supabase);

    expect(supabase.deletes("products")).toBe(1);
  });

  it("propaga el error al contar ventas", async () => {
    const supabase = mockSupabase({ order_items: fail(pgError("denied", "42501")) });

    await expect(deleteProduct("p1", supabase)).rejects.toMatchObject({ code: "42501" });
  });

  it("traduce el 23503 de la FK al mensaje de ventas (respaldo si la FK se endurece)", async () => {
    const supabase = mockSupabase({
      order_items: ok(null, 0),
      products: { delete: fail(pgError("violates foreign key", "23503")) },
    });

    await expect(deleteProduct("p1", supabase)).rejects.toThrow(PRODUCT_HAS_SALES_MESSAGE);
  });

  it("cualquier otro error del delete se propaga tal cual", async () => {
    const supabase = mockSupabase({
      order_items: ok(null, 0),
      products: { delete: fail(pgError("permission denied", "42501")) },
    });

    await expect(deleteProduct("p1", supabase)).rejects.toMatchObject({
      message: "permission denied",
      code: "42501",
    });
  });
});

describe("listMyOrders (vendedor)", () => {
  it("parte de order_items filtrando por seller_id", async () => {
    const supabase = mockSupabase({ order_items: [itemRow()] });

    await listMyOrders("s1", supabase);

    expect(supabase.filters("order_items")).toEqual([{ method: "eq", args: ["seller_id", "s1"] }]);
  });

  it("agrupa varios ítems del mismo pedido y suma myTotal solo con SUS ítems", async () => {
    const supabase = mockSupabase({
      order_items: [
        itemRow({ id: "i1", quantity: 2, price_snapshot: "100.00" }),
        itemRow({ id: "i2", quantity: 1, price_snapshot: "50.00" }),
      ],
    });

    const orders = await listMyOrders("s1", supabase);

    expect(orders).toHaveLength(1);
    expect(orders[0].myItems).toHaveLength(2);
    // 2×100 + 1×50 = 250, mientras que orders.total (el pedido completo) es 500.
    expect(orders[0].myTotal).toBe(250);
    expect(orders[0].total).toBe(500);
  });

  it("descarta filas cuyo pedido no llegó en el join", async () => {
    const supabase = mockSupabase({ order_items: [itemRow({ orders: null })] });

    await expect(listMyOrders("s1", supabase)).resolves.toEqual([]);
  });

  it("ordena los pedidos por created_at descendente", async () => {
    const supabase = mockSupabase({
      order_items: [
        itemRow({
          id: "i1",
          order_id: "viejo",
          orders: {
            id: "viejo",
            buyer_id: "u1",
            status: "pagado",
            total: "10.00",
            created_at: "2026-01-01T00:00:00Z",
          },
        }),
        itemRow({
          id: "i2",
          order_id: "nuevo",
          orders: {
            id: "nuevo",
            buyer_id: "u1",
            status: "pagado",
            total: "20.00",
            created_at: "2026-09-01T00:00:00Z",
          },
        }),
      ],
    });

    const orders = await listMyOrders("s1", supabase);

    expect(orders.map((order) => order.id)).toEqual(["nuevo", "viejo"]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ order_items: fail(pgError("denied", "42501")) });

    await expect(listMyOrders("s1", supabase)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("updateOrderStatus", () => {
  // La secuencia NO se valida acá: vive en el helper canMove de
  // hooks/useSellerOrders.ts (ver useSellerOrders.test.ts).
  it.each(["pagado", "enviado", "entregado", "cancelado", "pendiente"] as const)(
    "envía el status destino '%s' sin validar la secuencia",
    async (status) => {
      const supabase = mockSupabase({ orders: ok() });

      await updateOrderStatus("o1", status, supabase);

      expect(supabase.updates("orders")).toEqual([{ status }]);
      expect(supabase.filters("orders")).toEqual([{ method: "eq", args: ["id", "o1"] }]);
    },
  );

  it("propaga el error de la RLS", async () => {
    const supabase = mockSupabase({ orders: { update: fail(pgError("permission denied", "42501")) } });

    await expect(updateOrderStatus("o1", "enviado", supabase)).rejects.toMatchObject({
      code: "42501",
    });
  });
});
