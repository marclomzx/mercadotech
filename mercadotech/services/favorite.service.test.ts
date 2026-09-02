import { describe, expect, it } from "vitest";

import { isFavorite, listMine, toggle } from "@/services/favorite.service";
import { fail, mockSupabase, ok, pgError } from "@/services/test-utils/supabase-mock";

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    seller_id: "s1",
    title: "Laptop",
    condition: "nuevo",
    price: "1500.00",
    stock: 5,
    is_active: true,
    product_images: [{ image_path: "s1/p1/0.jpg", position: 0 }],
    reviews: [],
    ...overrides,
  };
}

describe("isFavorite", () => {
  it("true cuando existe la fila", async () => {
    const supabase = mockSupabase({ favorites: { maybeSingle: { id: "f1" } } });

    await expect(isFavorite("u1", "p1", supabase)).resolves.toBe(true);
    expect(supabase.filters("favorites")).toEqual([
      { method: "eq", args: ["user_id", "u1"] },
      { method: "eq", args: ["product_id", "p1"] },
    ]);
  });

  it("false cuando no existe", async () => {
    const supabase = mockSupabase({ favorites: { maybeSingle: null } });

    await expect(isFavorite("u1", "p1", supabase)).resolves.toBe(false);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ favorites: fail(pgError("boom")) });

    await expect(isFavorite("u1", "p1", supabase)).rejects.toMatchObject({ message: "boom" });
  });
});

describe("toggle", () => {
  it("si ya era favorito, borra y devuelve false", async () => {
    const supabase = mockSupabase({ favorites: ok() });

    await expect(toggle("u1", "p1", true, supabase)).resolves.toBe(false);
    expect(supabase.deletes("favorites")).toBe(1);
    expect(supabase.inserts("favorites")).toEqual([]);
  });

  it("si no era favorito, inserta y devuelve true", async () => {
    const supabase = mockSupabase({ favorites: ok() });

    await expect(toggle("u1", "p1", false, supabase)).resolves.toBe(true);
    expect(supabase.inserts("favorites")).toEqual([{ user_id: "u1", product_id: "p1" }]);
    expect(supabase.deletes("favorites")).toBe(0);
  });

  it("propaga el error del delete", async () => {
    const supabase = mockSupabase({ favorites: { delete: fail(pgError("denied", "42501")) } });

    await expect(toggle("u1", "p1", true, supabase)).rejects.toMatchObject({ code: "42501" });
  });

  it("propaga el error del insert", async () => {
    const supabase = mockSupabase({ favorites: { insert: fail(pgError("denied", "42501")) } });

    await expect(toggle("u1", "p1", false, supabase)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("listMine", () => {
  it("mapea los productos del join", async () => {
    const supabase = mockSupabase({
      favorites: [{ product_id: "p1", created_at: "2026-09-01", products: productRow() }],
    });

    const products = await listMine("u1", supabase);

    expect(products).toHaveLength(1);
    expect(products[0].price).toBe(1500);
  });

  it("descarta los favoritos cuyo producto quedó oculto por la RLS (products null)", async () => {
    const supabase = mockSupabase({
      favorites: [
        { product_id: "p1", created_at: "2026-09-01", products: null },
        { product_id: "p2", created_at: "2026-09-02", products: productRow({ id: "p2" }) },
      ],
    });

    const products = await listMine("u1", supabase);

    expect(products.map((product) => product.id)).toEqual(["p2"]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ favorites: fail(pgError("boom")) });

    await expect(listMine("u1", supabase)).rejects.toMatchObject({ message: "boom" });
  });
});
