import { describe, expect, it } from "vitest";

import { canReview, create, getAverage, listByProduct } from "@/services/review.service";
import { fail, mockSupabase, pgError } from "@/services/test-utils/supabase-mock";

describe("listByProduct", () => {
  it("filtra por producto y ordena por fecha descendente", async () => {
    const supabase = mockSupabase({ reviews: [{ id: "r1", rating: 5 }] });

    const reviews = await listByProduct("p1", supabase);

    expect(reviews).toHaveLength(1);
    expect(supabase.filters("reviews")).toEqual([
      { method: "eq", args: ["product_id", "p1"] },
      { method: "order", args: ["created_at", { ascending: false }] },
    ]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ reviews: fail(pgError("boom")) });

    await expect(listByProduct("p1", supabase)).rejects.toMatchObject({ message: "boom" });
  });
});

describe("getAverage", () => {
  it("promedia las calificaciones", async () => {
    const supabase = mockSupabase({ reviews: [{ rating: 5 }, { rating: 4 }, { rating: 3 }] });

    await expect(getAverage("p1", supabase)).resolves.toEqual({ average: 4, count: 3 });
  });

  it("sin reseñas devuelve promedio 0 (no NaN)", async () => {
    const supabase = mockSupabase({ reviews: [] });

    await expect(getAverage("p1", supabase)).resolves.toEqual({ average: 0, count: 0 });
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ reviews: fail(pgError("boom")) });

    await expect(getAverage("p1", supabase)).rejects.toMatchObject({ message: "boom" });
  });
});

// canReview replica la condición de reviews_insert_verified_purchase: pedido
// propio ENTREGADO que contiene el producto, y sin reseña previa.
describe("canReview", () => {
  it("false si el comprador ya reseñó ese producto, sin consultar pedidos", async () => {
    const supabase = mockSupabase({ reviews: { maybeSingle: { id: "r1" } } });

    await expect(canReview("p1", "u1", supabase)).resolves.toEqual({
      allowed: false,
      orderId: null,
    });
    expect(supabase.callsFor("orders")).toEqual([]);
  });

  it("false si no tiene ningún pedido entregado, sin consultar order_items", async () => {
    const supabase = mockSupabase({
      reviews: { maybeSingle: null },
      orders: [],
    });

    await expect(canReview("p1", "u1", supabase)).resolves.toEqual({
      allowed: false,
      orderId: null,
    });
    expect(supabase.callsFor("order_items")).toEqual([]);
    expect(supabase.filters("orders")).toContainEqual({
      method: "eq",
      args: ["status", "entregado"],
    });
  });

  it("false si tiene pedidos entregados pero ninguno incluye el producto", async () => {
    const supabase = mockSupabase({
      reviews: { maybeSingle: null },
      orders: [{ id: "o1" }],
      order_items: { maybeSingle: null },
    });

    await expect(canReview("p1", "u1", supabase)).resolves.toEqual({
      allowed: false,
      orderId: null,
    });
  });

  it("true con el orderId del pedido entregado que contiene el producto", async () => {
    const supabase = mockSupabase({
      reviews: { maybeSingle: null },
      orders: [{ id: "o1" }, { id: "o2" }],
      order_items: { maybeSingle: { order_id: "o2" } },
    });

    await expect(canReview("p1", "u1", supabase)).resolves.toEqual({
      allowed: true,
      orderId: "o2",
    });
    // Busca el producto solo dentro de los pedidos entregados del comprador.
    expect(supabase.filters("order_items")).toContainEqual({
      method: "in",
      args: ["order_id", ["o1", "o2"]],
    });
  });

  it.each([
    ["reviews", { reviews: fail(pgError("r-boom")) }, "r-boom"],
    [
      "orders",
      { reviews: { maybeSingle: null }, orders: fail(pgError("o-boom")) },
      "o-boom",
    ],
    [
      "order_items",
      {
        reviews: { maybeSingle: null },
        orders: [{ id: "o1" }],
        order_items: fail(pgError("i-boom")),
      },
      "i-boom",
    ],
  ])("propaga el error de %s", async (_table, config, message) => {
    const supabase = mockSupabase(config);

    await expect(canReview("p1", "u1", supabase)).rejects.toMatchObject({ message });
  });
});

describe("create", () => {
  it("inserta la reseña con su order_id (lo exige la política de compra verificada)", async () => {
    const supabase = mockSupabase({ reviews: { single: { id: "r1", rating: 5 } } });

    await create(
      { productId: "p1", buyerId: "u1", orderId: "o1", rating: 5, comment: "Excelente" },
      supabase,
    );

    expect(supabase.inserts("reviews")).toEqual([
      {
        product_id: "p1",
        buyer_id: "u1",
        order_id: "o1",
        rating: 5,
        comment: "Excelente",
      },
    ]);
  });

  it("un comentario vacío se guarda como null, no como cadena vacía", async () => {
    const supabase = mockSupabase({ reviews: { single: { id: "r1" } } });

    await create({ productId: "p1", buyerId: "u1", orderId: "o1", rating: 4, comment: "" }, supabase);

    expect(supabase.inserts("reviews")[0]).toMatchObject({ comment: null });
  });

  it("propaga el error de la RLS", async () => {
    const supabase = mockSupabase({ reviews: { insert: fail(pgError("permission denied", "42501")) } });

    await expect(
      create({ productId: "p1", buyerId: "u1", orderId: "o1", rating: 5 }, supabase),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
