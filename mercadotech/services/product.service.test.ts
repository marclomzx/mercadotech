import { describe, expect, it } from "vitest";

import { PRODUCTS_PAGE_SIZE } from "@/lib/constants/catalog";
import {
  getProductById,
  getProductImages,
  listActiveProducts,
  mapProductRow,
  registerView,
  type ProductQueryRow,
} from "@/services/product.service";
import { fail, mockSupabase, ok, pgError } from "@/services/test-utils/supabase-mock";

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    seller_id: "s1",
    category_id: "cat1",
    title: "Laptop Gamer",
    description: "Una laptop",
    brand: "Acme",
    condition: "nuevo",
    price: "1500.00",
    stock: 5,
    is_active: true,
    created_at: "2026-09-01T10:00:00Z",
    product_images: [{ image_path: "s1/p1/0.jpg", position: 0 }],
    reviews: [{ rating: 4 }, { rating: 5 }],
    ...overrides,
  } as unknown as ProductQueryRow;
}

describe("mapProductRow", () => {
  it("convierte price string → number y calcula el promedio de reseñas", () => {
    const supabase = mockSupabase();

    const product = mapProductRow(productRow(), supabase);

    expect(product.price).toBe(1500);
    expect(product.average_rating).toBe(4.5);
    expect(product.review_count).toBe(2);
  });

  it("usa como portada la imagen de menor position, sin mutar el array de entrada", () => {
    const supabase = mockSupabase();
    const row = productRow({
      product_images: [
        { image_path: "s1/p1/2.jpg", position: 2 },
        { image_path: "s1/p1/0.jpg", position: 0 },
        { image_path: "s1/p1/1.jpg", position: 1 },
      ],
    });

    const product = mapProductRow(row, supabase);

    expect(product.image_url).toContain("s1/p1/0.jpg");
    // El sort del service trabaja sobre una copia: el orden original sigue igual.
    expect(row.product_images[0].image_path).toBe("s1/p1/2.jpg");
  });

  it("sin imágenes deja image_url en null; sin reseñas deja average_rating en null", () => {
    const supabase = mockSupabase();

    const product = mapProductRow(productRow({ product_images: [], reviews: [] }), supabase);

    expect(product.image_url).toBeNull();
    expect(product.average_rating).toBeNull();
    expect(product.review_count).toBe(0);
  });
});

describe("listActiveProducts — filtros", () => {
  it("siempre filtra is_active = true y pagina con el rango de la página 1", async () => {
    const supabase = mockSupabase({ products: ok([productRow()], 1) });

    const result = await listActiveProducts({}, supabase);

    expect(result.total).toBe(1);
    expect(supabase.filters("products")).toContainEqual({
      method: "eq",
      args: ["is_active", true],
    });
    expect(supabase.filters("products")).toContainEqual({
      method: "range",
      args: [0, PRODUCTS_PAGE_SIZE - 1],
    });
  });

  it("calcula el rango de una página posterior", async () => {
    const supabase = mockSupabase({ products: ok([], 0) });

    await listActiveProducts({ page: 3 }, supabase);

    expect(supabase.filters("products")).toContainEqual({
      method: "range",
      args: [PRODUCTS_PAGE_SIZE * 2, PRODUCTS_PAGE_SIZE * 3 - 1],
    });
  });

  it("una página inválida (0 o negativa) cae a la página 1", async () => {
    const supabase = mockSupabase({ products: ok([], 0) });

    await listActiveProducts({ page: 0 }, supabase);

    expect(supabase.filters("products")).toContainEqual({
      method: "range",
      args: [0, PRODUCTS_PAGE_SIZE - 1],
    });
  });

  it("resuelve categorySlug a category_id antes de consultar productos", async () => {
    const supabase = mockSupabase({
      categories: { maybeSingle: { id: "cat1", slug: "laptops", name: "Laptops" } },
      products: ok([productRow()], 1),
    });

    await listActiveProducts({ categorySlug: "laptops" }, supabase);

    expect(supabase.filters("categories")).toContainEqual({
      method: "eq",
      args: ["slug", "laptops"],
    });
    expect(supabase.filters("products")).toContainEqual({
      method: "eq",
      args: ["category_id", "cat1"],
    });
  });

  it("categoría inexistente: devuelve vacío sin consultar products", async () => {
    const supabase = mockSupabase({ categories: { maybeSingle: null } });

    const result = await listActiveProducts({ categorySlug: "no-existe" }, supabase);

    expect(result).toEqual({ items: [], total: 0 });
    expect(supabase.callsFor("products")).toEqual([]);
  });

  it("búsqueda: arma el .or() sobre title y brand", async () => {
    const supabase = mockSupabase({ products: ok([], 0) });

    await listActiveProducts({ search: "laptop" }, supabase);

    expect(supabase.filters("products")).toContainEqual({
      method: "or",
      args: ["title.ilike.%laptop%,brand.ilike.%laptop%"],
    });
  });

  it("búsqueda: sanea comas y paréntesis, que romperían el parseo de PostgREST", async () => {
    const supabase = mockSupabase({ products: ok([], 0) });

    await listActiveProducts({ search: "laptop, gamer (nueva)" }, supabase);

    expect(supabase.filters("products")).toContainEqual({
      method: "or",
      args: ["title.ilike.%laptop  gamer  nueva%,brand.ilike.%laptop  gamer  nueva%"],
    });
  });

  it("condición: usa .in() solo si el arreglo trae valores", async () => {
    const conMock = mockSupabase({ products: ok([], 0) });
    await listActiveProducts({ condition: ["nuevo", "usado"] }, conMock);
    expect(conMock.filters("products")).toContainEqual({
      method: "in",
      args: ["condition", ["nuevo", "usado"]],
    });

    const sinMock = mockSupabase({ products: ok([], 0) });
    await listActiveProducts({ condition: [] }, sinMock);
    expect(sinMock.filters("products").some((filter) => filter.method === "in")).toBe(false);
  });

  it("precio: aplica gte y lte solo cuando los límites están definidos", async () => {
    const supabase = mockSupabase({ products: ok([], 0) });

    await listActiveProducts({ minPrice: 100, maxPrice: 900 }, supabase);

    expect(supabase.filters("products")).toContainEqual({ method: "gte", args: ["price", 100] });
    expect(supabase.filters("products")).toContainEqual({ method: "lte", args: ["price", 900] });
  });

  it("precio 0 como mínimo sí se aplica (no se confunde con 'sin filtro')", async () => {
    const supabase = mockSupabase({ products: ok([], 0) });

    await listActiveProducts({ minPrice: 0 }, supabase);

    expect(supabase.filters("products")).toContainEqual({ method: "gte", args: ["price", 0] });
  });

  it.each([
    ["precio_asc", ["price", { ascending: true }]],
    ["precio_desc", ["price", { ascending: false }]],
  ] as const)("orden %s", async (sort, expected) => {
    const supabase = mockSupabase({ products: ok([], 0) });

    await listActiveProducts({ sort }, supabase);

    expect(supabase.filters("products")).toContainEqual({ method: "order", args: [...expected] });
  });

  it("sin sort explícito ordena por created_at descendente", async () => {
    const supabase = mockSupabase({ products: ok([], 0) });

    await listActiveProducts({}, supabase);

    expect(supabase.filters("products")).toContainEqual({
      method: "order",
      args: ["created_at", { ascending: false }],
    });
  });

  it("total = 0 cuando PostgREST no devuelve count", async () => {
    const supabase = mockSupabase({ products: ok([], null) });

    const result = await listActiveProducts({}, supabase);

    expect(result.total).toBe(0);
  });

  it("propaga el error de la query", async () => {
    const supabase = mockSupabase({ products: fail(pgError("denied", "42501")) });

    await expect(listActiveProducts({}, supabase)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("getProductById", () => {
  it("devuelve el producto mapeado", async () => {
    const supabase = mockSupabase({ products: { maybeSingle: productRow() } });

    const product = await getProductById("p1", supabase);

    expect(product?.price).toBe(1500);
    expect(supabase.filters("products")).toContainEqual({ method: "eq", args: ["id", "p1"] });
  });

  it("devuelve null si no existe", async () => {
    const supabase = mockSupabase({ products: { maybeSingle: null } });

    await expect(getProductById("p1", supabase)).resolves.toBeNull();
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ products: fail(pgError("boom")) });

    await expect(getProductById("p1", supabase)).rejects.toMatchObject({ message: "boom" });
  });
});

describe("getProductImages", () => {
  it("ordena por position y resuelve la URL pública de cada imagen", async () => {
    const supabase = mockSupabase({
      product_images: [
        { id: "i1", product_id: "p1", image_path: "s1/p1/0.jpg", position: 0 },
        { id: "i2", product_id: "p1", image_path: "s1/p1/1.jpg", position: 1 },
      ],
    });

    const images = await getProductImages("p1", supabase);

    expect(images.map((image) => image.image_url)).toEqual([
      expect.stringContaining("s1/p1/0.jpg"),
      expect.stringContaining("s1/p1/1.jpg"),
    ]);
    expect(supabase.filters("product_images")).toEqual([
      { method: "eq", args: ["product_id", "p1"] },
      { method: "order", args: ["position", { ascending: true }] },
    ]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ product_images: fail(pgError("boom")) });

    await expect(getProductImages("p1", supabase)).rejects.toMatchObject({ message: "boom" });
  });
});

describe("registerView", () => {
  it("inserta product_id y user_id (ambos exigidos por la política RLS)", async () => {
    const supabase = mockSupabase({ product_views: ok() });

    await registerView("p1", "u1", supabase);

    expect(supabase.inserts("product_views")).toEqual([{ product_id: "p1", user_id: "u1" }]);
  });

  it("propaga el error (el caller lo trata como fire-and-forget)", async () => {
    const supabase = mockSupabase({ product_views: { insert: fail(pgError("denied", "42501")) } });

    await expect(registerView("p1", "u1", supabase)).rejects.toMatchObject({ code: "42501" });
  });
});
