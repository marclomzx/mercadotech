import { describe, expect, it } from "vitest";

import { addItem, clear, getItems, removeItem, updateQuantity } from "@/services/cart.service";
import { fail, mockSupabase, ok, pgError } from "@/services/test-utils/supabase-mock";

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    title: "Laptop",
    price: "1500.00",
    stock: 10,
    condition: "nuevo",
    is_active: true,
    product_images: [{ image_path: "s1/p1/0.jpg", position: 0 }],
    reviews: [{ rating: 5 }],
    ...overrides,
  };
}

describe("getItems", () => {
  it("mapea el producto embebido y convierte price a number", async () => {
    const supabase = mockSupabase({
      cart_items: [{ id: "c1", product_id: "p1", quantity: 2, products: productRow() }],
    });

    const items = await getItems("u1", supabase);

    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
    expect(items[0].product?.price).toBe(1500);
    expect(items[0].product?.image_url).toContain("s1/p1/0.jpg");
  });

  it("deja product en null cuando el join no trajo el producto (inactivo por RLS)", async () => {
    const supabase = mockSupabase({
      cart_items: [{ id: "c1", product_id: "p1", quantity: 1, products: null }],
    });

    const items = await getItems("u1", supabase);

    expect(items[0].product).toBeNull();
  });

  it("filtra por user_id y ordena por created_at descendente", async () => {
    const supabase = mockSupabase({ cart_items: [] });

    await getItems("u1", supabase);

    expect(supabase.filters("cart_items")).toEqual([
      { method: "eq", args: ["user_id", "u1"] },
      { method: "order", args: ["created_at", { ascending: false }] },
    ]);
  });

  it("propaga el error de lectura tal cual", async () => {
    const supabase = mockSupabase({ cart_items: fail(pgError("permission denied", "42501")) });

    await expect(getItems("u1", supabase)).rejects.toMatchObject({
      message: "permission denied",
      code: "42501",
    });
  });
});

describe("addItem — producto que aún no está en el carrito", () => {
  it("inserta la cantidad pedida y la devuelve", async () => {
    const supabase = mockSupabase({
      products: { single: { stock: 10 } },
      cart_items: { maybeSingle: null },
    });

    const result = await addItem("u1", "p1", 2, supabase);

    expect(result).toBe(2);
    expect(supabase.inserts("cart_items")).toEqual([
      { user_id: "u1", product_id: "p1", quantity: 2 },
    ]);
    expect(supabase.updates("cart_items")).toEqual([]);
  });

  it("usa quantity = 1 por default", async () => {
    const supabase = mockSupabase({
      products: { single: { stock: 10 } },
      cart_items: { maybeSingle: null },
    });

    const result = await addItem("u1", "p1", undefined, supabase);

    expect(result).toBe(1);
    expect(supabase.inserts("cart_items")).toEqual([
      { user_id: "u1", product_id: "p1", quantity: 1 },
    ]);
  });

  it("recorta al stock cuando se pide más de lo disponible", async () => {
    const supabase = mockSupabase({
      products: { single: { stock: 3 } },
      cart_items: { maybeSingle: null },
    });

    const result = await addItem("u1", "p1", 99, supabase);

    expect(result).toBe(3);
    expect(supabase.inserts("cart_items")).toEqual([
      { user_id: "u1", product_id: "p1", quantity: 3 },
    ]);
  });
});

describe("addItem — producto duplicado (unique user_id+product_id)", () => {
  it("SUMA a la cantidad existente en vez de reemplazarla", async () => {
    const supabase = mockSupabase({
      products: { single: { stock: 10 } },
      cart_items: { maybeSingle: { id: "c1", quantity: 3 } },
    });

    const result = await addItem("u1", "p1", 2, supabase);

    expect(result).toBe(5);
    expect(supabase.updates("cart_items")).toEqual([{ quantity: 5 }]);
    expect(supabase.inserts("cart_items")).toEqual([]);
  });

  it("la suma se recorta al stock (3 + 5 con stock 4 → 4)", async () => {
    const supabase = mockSupabase({
      products: { single: { stock: 4 } },
      cart_items: { maybeSingle: { id: "c1", quantity: 3 } },
    });

    const result = await addItem("u1", "p1", 5, supabase);

    expect(result).toBe(4);
    expect(supabase.updates("cart_items")).toContainEqual({ quantity: 4 });
    expect(supabase.filters("cart_items")).toContainEqual({ method: "eq", args: ["id", "c1"] });
  });

  it("frontera: la suma que da exactamente el stock entra sin recorte", async () => {
    const supabase = mockSupabase({
      products: { single: { stock: 5 } },
      cart_items: { maybeSingle: { id: "c1", quantity: 3 } },
    });

    const result = await addItem("u1", "p1", 2, supabase);

    expect(result).toBe(5);
    expect(supabase.updates("cart_items")).toEqual([{ quantity: 5 }]);
  });
});

describe("addItem — rechazo y errores", () => {
  it("lanza cuando el stock es 0, con el mensaje real del service", async () => {
    const supabase = mockSupabase({
      products: { single: { stock: 0 } },
      cart_items: { maybeSingle: null },
    });

    await expect(addItem("u1", "p1", 1, supabase)).rejects.toThrow(
      "Este producto no tiene stock disponible.",
    );
    expect(supabase.inserts("cart_items")).toEqual([]);
    expect(supabase.updates("cart_items")).toEqual([]);
  });

  // comportamiento actual, revisar: addItem NO valida el signo de `quantity`.
  // Con una cantidad negativa el total baja y se ESCRIBE ese valor menor —
  // "addItem" termina restando. Hoy nadie lo llama así (la UI solo suma), pero
  // el contrato del service no lo impide.
  it("comportamiento actual: una cantidad negativa reduce el carrito en vez de rechazarse", async () => {
    const supabase = mockSupabase({
      products: { single: { stock: 10 } },
      cart_items: { maybeSingle: { id: "c1", quantity: 3 } },
    });

    const result = await addItem("u1", "p1", -1, supabase);

    expect(result).toBe(2);
    expect(supabase.updates("cart_items")).toEqual([{ quantity: 2 }]);
  });

  // comportamiento actual, revisar: si el total queda en 0 o menos, el error
  // dice "no tiene stock disponible" aunque el stock sea abundante — el
  // mensaje culpa al stock de algo que causó la cantidad pedida.
  it("comportamiento actual: total <= 0 con stock disponible lanza el error de stock", async () => {
    const supabase = mockSupabase({
      products: { single: { stock: 10 } },
      cart_items: { maybeSingle: { id: "c1", quantity: 1 } },
    });

    await expect(addItem("u1", "p1", -5, supabase)).rejects.toThrow(
      "Este producto no tiene stock disponible.",
    );
  });

  it("propaga el error al leer el producto, sin tocar cart_items", async () => {
    const supabase = mockSupabase({
      products: fail(pgError("no rows", "PGRST116")),
    });

    await expect(addItem("u1", "p1", 1, supabase)).rejects.toMatchObject({ code: "PGRST116" });
    expect(supabase.callsFor("cart_items")).toEqual([]);
  });

  it("propaga el error al leer el carrito", async () => {
    const supabase = mockSupabase({
      products: { single: { stock: 5 } },
      cart_items: { select: fail(pgError("permission denied", "42501")) },
    });

    await expect(addItem("u1", "p1", 1, supabase)).rejects.toMatchObject({ code: "42501" });
  });

  it("propaga el error del update sobre un duplicado", async () => {
    const supabase = mockSupabase({
      products: { single: { stock: 5 } },
      cart_items: {
        maybeSingle: { id: "c1", quantity: 1 },
        update: fail(pgError("update denied", "42501")),
      },
    });

    await expect(addItem("u1", "p1", 1, supabase)).rejects.toMatchObject({
      message: "update denied",
    });
  });

  it("propaga el error del insert de un producto nuevo", async () => {
    const supabase = mockSupabase({
      products: { single: { stock: 5 } },
      cart_items: {
        maybeSingle: null,
        insert: fail(pgError("insert denied", "42501")),
      },
    });

    await expect(addItem("u1", "p1", 1, supabase)).rejects.toMatchObject({
      message: "insert denied",
    });
  });
});

describe("updateQuantity / removeItem / clear", () => {
  it("updateQuantity actualiza la fila por id", async () => {
    const supabase = mockSupabase({ cart_items: ok() });

    await updateQuantity("c1", 7, supabase);

    expect(supabase.updates("cart_items")).toEqual([{ quantity: 7 }]);
    expect(supabase.filters("cart_items")).toEqual([{ method: "eq", args: ["id", "c1"] }]);
  });

  it("updateQuantity propaga el error", async () => {
    const supabase = mockSupabase({ cart_items: { update: fail(pgError("denied")) } });

    await expect(updateQuantity("c1", 7, supabase)).rejects.toMatchObject({ message: "denied" });
  });

  it("removeItem borra por id", async () => {
    const supabase = mockSupabase({ cart_items: ok() });

    await removeItem("c1", supabase);

    expect(supabase.deletes("cart_items")).toBe(1);
    expect(supabase.filters("cart_items")).toEqual([{ method: "eq", args: ["id", "c1"] }]);
  });

  it("removeItem propaga el error", async () => {
    const supabase = mockSupabase({ cart_items: { delete: fail(pgError("denied")) } });

    await expect(removeItem("c1", supabase)).rejects.toMatchObject({ message: "denied" });
  });

  it("clear borra todas las filas del usuario", async () => {
    const supabase = mockSupabase({ cart_items: ok() });

    await clear("u1", supabase);

    expect(supabase.deletes("cart_items")).toBe(1);
    expect(supabase.filters("cart_items")).toEqual([{ method: "eq", args: ["user_id", "u1"] }]);
  });

  it("clear propaga el error", async () => {
    const supabase = mockSupabase({ cart_items: { delete: fail(pgError("denied")) } });

    await expect(clear("u1", supabase)).rejects.toMatchObject({ message: "denied" });
  });
});
