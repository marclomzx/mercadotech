import { beforeEach, describe, expect, it, vi } from "vitest";

// DECISIÓN 7 (mockeo de dos niveles): el cliente Supabase se INYECTA por el
// último parámetro; lib/ai/* es la ÚNICA excepción que se mockea por módulo,
// porque embedding.service lo importa directo (diseño de la sesión 4) y no
// hay parámetro por donde sustituirlo.
//
// El mock es PARCIAL a propósito: solo se reemplaza generateEmbedding (lo
// único que sale a la red). buildProductEmbeddingText y
// buildSupportArticleEmbeddingText son puras y se dejan reales, así el test
// verifica el texto que de verdad se vectoriza.
vi.mock("@/lib/ai/embeddings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/embeddings")>();
  return { ...actual, generateEmbedding: vi.fn() };
});

import { generateEmbedding } from "@/lib/ai/embeddings";
import {
  deleteEmbedding,
  indexProduct,
  indexSource,
  indexSupportArticle,
} from "@/services/embedding.service";
import { fail, mockSupabase, ok, pgError } from "@/services/test-utils/supabase-mock";

const EMBEDDING = [0.1, 0.2, 0.3];

beforeEach(() => {
  vi.mocked(generateEmbedding).mockReset();
  vi.mocked(generateEmbedding).mockResolvedValue(EMBEDDING);
});

function activeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    title: "Laptop Gamer",
    description: "16GB RAM",
    brand: "Acme",
    condition: "nuevo",
    price: "1500.00",
    is_active: true,
    categories: { name: "Laptops" },
    ...overrides,
  };
}

function publishedArticle(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    title: "¿Cómo devuelvo un producto?",
    content: "Tienes 7 días.",
    category: "Devoluciones",
    is_published: true,
    ...overrides,
  };
}

describe("indexProduct", () => {
  it("arma el texto real, lo vectoriza y hace upsert idempotente", async () => {
    const supabase = mockSupabase({
      products: { maybeSingle: activeProduct() },
      knowledge_embeddings: ok(),
    });

    await expect(indexProduct("p1", supabase)).resolves.toBe(true);

    const [text] = vi.mocked(generateEmbedding).mock.calls[0];
    expect(text).toContain("Título: Laptop Gamer");
    expect(text).toContain("Marca: Acme");
    expect(text).toContain("Categoría: Laptops");
    expect(text).toContain("Descripción: 16GB RAM");

    expect(supabase.upserts("knowledge_embeddings")).toEqual([
      {
        source_type: "producto",
        source_id: "p1",
        chunk_index: 0,
        content: text,
        // pgvector viaja como texto por PostgREST.
        embedding: "[0.1,0.2,0.3]",
        metadata: {
          title: "Laptop Gamer",
          brand: "Acme",
          category: "Laptops",
          // numeric string → number, igual que el resto del proyecto.
          price: 1500,
        },
      },
    ]);
    expect(supabase.argsFor("knowledge_embeddings", "upsert")[0][1]).toEqual({
      onConflict: "source_type,source_id,chunk_index",
    });
  });

  it("sin categoría, la metadata la deja en null", async () => {
    const supabase = mockSupabase({
      products: { maybeSingle: activeProduct({ categories: null }) },
      knowledge_embeddings: ok(),
    });

    await indexProduct("p1", supabase);

    expect(supabase.upserts("knowledge_embeddings")[0]).toMatchObject({
      metadata: expect.objectContaining({ category: null }),
    });
  });

  it("producto inexistente: devuelve false sin vectorizar ni escribir", async () => {
    const supabase = mockSupabase({ products: { maybeSingle: null } });

    await expect(indexProduct("p1", supabase)).resolves.toBe(false);
    expect(generateEmbedding).not.toHaveBeenCalled();
    expect(supabase.callsFor("knowledge_embeddings")).toEqual([]);
  });

  it("producto pausado: devuelve false (no debe ser recuperable por búsqueda semántica)", async () => {
    const supabase = mockSupabase({
      products: { maybeSingle: activeProduct({ is_active: false }) },
    });

    await expect(indexProduct("p1", supabase)).resolves.toBe(false);
    expect(generateEmbedding).not.toHaveBeenCalled();
  });

  it("propaga el error de lectura del producto", async () => {
    const supabase = mockSupabase({ products: fail(pgError("denied", "42501")) });

    await expect(indexProduct("p1", supabase)).rejects.toMatchObject({ code: "42501" });
  });

  it("propaga el error del proveedor de IA, sin escribir la ficha", async () => {
    vi.mocked(generateEmbedding).mockRejectedValue(new Error("HTTP 401: token inválido"));
    const supabase = mockSupabase({ products: { maybeSingle: activeProduct() } });

    await expect(indexProduct("p1", supabase)).rejects.toThrow("HTTP 401: token inválido");
    expect(supabase.callsFor("knowledge_embeddings")).toEqual([]);
  });

  it("propaga el error del upsert", async () => {
    const supabase = mockSupabase({
      products: { maybeSingle: activeProduct() },
      knowledge_embeddings: { upsert: fail(pgError("permission denied", "42501")) },
    });

    await expect(indexProduct("p1", supabase)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("indexSupportArticle", () => {
  it("ficha el artículo publicado con su metadata", async () => {
    const supabase = mockSupabase({
      support_articles: { maybeSingle: publishedArticle() },
      knowledge_embeddings: ok(),
    });

    await expect(indexSupportArticle("a1", supabase)).resolves.toBe(true);

    expect(supabase.upserts("knowledge_embeddings")[0]).toMatchObject({
      source_type: "articulo_soporte",
      source_id: "a1",
      metadata: { title: "¿Cómo devuelvo un producto?", category: "Devoluciones" },
    });
  });

  it("artículo no publicado: devuelve false sin vectorizar", async () => {
    const supabase = mockSupabase({
      support_articles: { maybeSingle: publishedArticle({ is_published: false }) },
    });

    await expect(indexSupportArticle("a1", supabase)).resolves.toBe(false);
    expect(generateEmbedding).not.toHaveBeenCalled();
  });

  it("artículo inexistente: devuelve false", async () => {
    const supabase = mockSupabase({ support_articles: { maybeSingle: null } });

    await expect(indexSupportArticle("a1", supabase)).resolves.toBe(false);
  });

  it("propaga el error de lectura", async () => {
    const supabase = mockSupabase({ support_articles: fail(pgError("boom")) });

    await expect(indexSupportArticle("a1", supabase)).rejects.toMatchObject({ message: "boom" });
  });
});

describe("deleteEmbedding", () => {
  it("borra filtrando por source_type y source_id", async () => {
    const supabase = mockSupabase({ knowledge_embeddings: ok() });

    await deleteEmbedding("producto", "p1", supabase);

    expect(supabase.deletes("knowledge_embeddings")).toBe(1);
    expect(supabase.filters("knowledge_embeddings")).toEqual([
      { method: "eq", args: ["source_type", "producto"] },
      { method: "eq", args: ["source_id", "p1"] },
    ]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ knowledge_embeddings: { delete: fail(pgError("denied")) } });

    await expect(deleteEmbedding("producto", "p1", supabase)).rejects.toMatchObject({
      message: "denied",
    });
  });
});

describe("indexSource", () => {
  it("producto visible → 'indexed', sin borrar nada", async () => {
    const supabase = mockSupabase({
      products: { maybeSingle: activeProduct() },
      knowledge_embeddings: ok(),
    });

    await expect(indexSource("producto", "p1", supabase)).resolves.toBe("indexed");
    expect(supabase.deletes("knowledge_embeddings")).toBe(0);
  });

  it("producto que dejó de ser visible → 'deleted' y limpia la ficha huérfana", async () => {
    const supabase = mockSupabase({
      products: { maybeSingle: activeProduct({ is_active: false }) },
      knowledge_embeddings: ok(),
    });

    await expect(indexSource("producto", "p1", supabase)).resolves.toBe("deleted");
    expect(supabase.deletes("knowledge_embeddings")).toBe(1);
  });

  it("artículo publicado → 'indexed' (rama de artículo, no de producto)", async () => {
    const supabase = mockSupabase({
      support_articles: { maybeSingle: publishedArticle() },
      knowledge_embeddings: ok(),
    });

    await expect(indexSource("articulo_soporte", "a1", supabase)).resolves.toBe("indexed");
    expect(supabase.callsFor("products")).toEqual([]);
  });

  it("artículo despublicado → 'deleted'", async () => {
    const supabase = mockSupabase({
      support_articles: { maybeSingle: publishedArticle({ is_published: false }) },
      knowledge_embeddings: ok(),
    });

    await expect(indexSource("articulo_soporte", "a1", supabase)).resolves.toBe("deleted");
    expect(supabase.deletes("knowledge_embeddings")).toBe(1);
  });
});
