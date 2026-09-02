import { describe, expect, it } from "vitest";

import { getCategoryBySlug, listCategories } from "@/services/category.service";
import { fail, mockSupabase, pgError } from "@/services/test-utils/supabase-mock";

describe("listCategories", () => {
  it("ordena alfabéticamente por nombre", async () => {
    const supabase = mockSupabase({ categories: [{ id: "c1", name: "Audio", slug: "audio" }] });

    const categories = await listCategories(supabase);

    expect(categories).toHaveLength(1);
    expect(supabase.filters("categories")).toEqual([
      { method: "order", args: ["name", { ascending: true }] },
    ]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ categories: fail(pgError("boom")) });

    await expect(listCategories(supabase)).rejects.toMatchObject({ message: "boom" });
  });
});

describe("getCategoryBySlug", () => {
  it("resuelve la categoría por su slug de URL", async () => {
    const supabase = mockSupabase({
      categories: { maybeSingle: { id: "c1", name: "Laptops", slug: "laptops" } },
    });

    const category = await getCategoryBySlug("laptops", supabase);

    expect(category).toMatchObject({ id: "c1" });
    expect(supabase.filters("categories")).toEqual([{ method: "eq", args: ["slug", "laptops"] }]);
  });

  it("devuelve null si el slug no existe", async () => {
    const supabase = mockSupabase({ categories: { maybeSingle: null } });

    await expect(getCategoryBySlug("no-existe", supabase)).resolves.toBeNull();
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ categories: fail(pgError("boom")) });

    await expect(getCategoryBySlug("laptops", supabase)).rejects.toMatchObject({ message: "boom" });
  });
});
