import { beforeEach, describe, expect, it, vi } from "vitest";

// DECISIÓN 7: Supabase inyectado; lib/ai/embeddings mockeado por módulo (es
// la única dependencia no inyectable, por diseño de la sesión 4).
vi.mock("@/lib/ai/embeddings", () => ({
  generateEmbedding: vi.fn(),
}));

import { generateEmbedding } from "@/lib/ai/embeddings";
import {
  VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD,
  VECTOR_SEARCH_DEFAULT_TOP_K,
  VECTOR_SEARCH_MAX_TOP_K,
} from "@/lib/constants/ai";
import { searchByEmbedding, searchByQuery, searchProducts } from "@/services/vector-search.service";
import { fail, mockSupabase, ok, pgError } from "@/services/test-utils/supabase-mock";

const EMBEDDING = [0.1, 0.2];

beforeEach(() => {
  vi.mocked(generateEmbedding).mockReset();
  vi.mocked(generateEmbedding).mockResolvedValue(EMBEDDING);
});

function matchRow(overrides: Record<string, unknown> = {}) {
  return {
    source_type: "producto",
    source_id: "p1",
    content: "Laptop Gamer",
    metadata: { title: "Laptop Gamer" },
    similarity: 0.8,
    ...overrides,
  };
}

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    seller_id: "s1",
    title: "Laptop Gamer",
    condition: "nuevo",
    price: "1500.00",
    stock: 5,
    is_active: true,
    product_images: [],
    reviews: [],
    ...overrides,
  };
}

describe("searchByEmbedding", () => {
  it("manda el vector como literal de texto y los defaults de lib/constants/ai", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [matchRow()] } });

    await searchByEmbedding(EMBEDDING, {}, supabase);

    expect(supabase.rpcCalls()).toEqual([
      {
        fn: "match_knowledge",
        args: {
          query_embedding: "[0.1,0.2]",
          p_source_type: undefined,
          match_count: VECTOR_SEARCH_DEFAULT_TOP_K,
          similarity_threshold: VECTOR_SEARCH_DEFAULT_SIMILARITY_THRESHOLD,
        },
      },
    ]);
  });

  it("pasa sourceType, topK y threshold explícitos", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [] } });

    await searchByEmbedding(
      EMBEDDING,
      { sourceType: "articulo_soporte", topK: 3, similarityThreshold: 0.55 },
      supabase,
    );

    expect(supabase.rpcCalls()[0].args).toMatchObject({
      p_source_type: "articulo_soporte",
      match_count: 3,
      similarity_threshold: 0.55,
    });
  });

  it("recorta topK al tope duro VECTOR_SEARCH_MAX_TOP_K", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [] } });

    await searchByEmbedding(EMBEDDING, { topK: 999 }, supabase);

    expect(supabase.rpcCalls()[0].args).toMatchObject({ match_count: VECTOR_SEARCH_MAX_TOP_K });
  });

  it("sourceType null se manda como undefined (deja el default de Postgres: ambas fuentes)", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [] } });

    await searchByEmbedding(EMBEDDING, { sourceType: null }, supabase);

    expect(supabase.rpcCalls()[0].args).toMatchObject({ p_source_type: undefined });
  });

  it("normaliza las filas del RPC a VectorMatch", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [matchRow()] } });

    await expect(searchByEmbedding(EMBEDDING, {}, supabase)).resolves.toEqual([
      {
        sourceType: "producto",
        sourceId: "p1",
        content: "Laptop Gamer",
        metadata: { title: "Laptop Gamer" },
        similarity: 0.8,
      },
    ]);
  });

  it("metadata null se normaliza a objeto vacío", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [matchRow({ metadata: null })] } });

    const matches = await searchByEmbedding(EMBEDDING, {}, supabase);

    expect(matches[0].metadata).toEqual({});
  });

  it("data null devuelve lista vacía", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: ok(null) } });

    await expect(searchByEmbedding(EMBEDDING, {}, supabase)).resolves.toEqual([]);
  });

  it("propaga el error del RPC", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: fail(pgError("denied", "42501")) } });

    await expect(searchByEmbedding(EMBEDDING, {}, supabase)).rejects.toMatchObject({
      code: "42501",
    });
  });
});

describe("searchByQuery", () => {
  it("vectoriza la consulta y delega en el RPC", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [matchRow()] } });

    const matches = await searchByQuery("laptop liviana", { topK: 2 }, supabase);

    expect(generateEmbedding).toHaveBeenCalledWith("laptop liviana");
    expect(supabase.rpcCalls()[0].args).toMatchObject({ match_count: 2 });
    expect(matches).toHaveLength(1);
  });

  it("propaga el error del proveedor de embeddings sin llamar al RPC", async () => {
    vi.mocked(generateEmbedding).mockRejectedValue(new Error("provider_down"));
    const supabase = mockSupabase();

    await expect(searchByQuery("laptop", {}, supabase)).rejects.toThrow("provider_down");
    expect(supabase.rpcCalls()).toEqual([]);
  });
});

describe("searchProducts", () => {
  it("acota la búsqueda a fichas de producto e hidrata contra products", async () => {
    const supabase = mockSupabase({
      rpc: { match_knowledge: [matchRow()] },
      products: [productRow()],
    });

    const results = await searchProducts("laptop", {}, supabase);

    expect(supabase.rpcCalls()[0].args).toMatchObject({ p_source_type: "producto" });
    expect(results).toHaveLength(1);
    // Precio ACTUAL del producto, no la copia de la ficha.
    expect(results[0].product.price).toBe(1500);
    expect(results[0].similarity).toBe(0.8);
  });

  it("sin coincidencias no consulta products", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [] } });

    await expect(searchProducts("nada", {}, supabase)).resolves.toEqual([]);
    expect(supabase.callsFor("products")).toEqual([]);
  });

  it("DESCARTA los resultados huérfanos: ficha viva cuyo producto ya no existe o está inactivo", async () => {
    const supabase = mockSupabase({
      rpc: {
        match_knowledge: [
          matchRow({ source_id: "vivo", similarity: 0.9 }),
          matchRow({ source_id: "huerfano", similarity: 0.7 }),
        ],
      },
      // products solo devuelve el vivo (el otro fue borrado o pausado).
      products: [productRow({ id: "vivo" })],
    });

    const results = await searchProducts("laptop", {}, supabase);

    expect(results.map((result) => result.product.id)).toEqual(["vivo"]);
  });

  it("hidrata solo los ids recuperados y filtra is_active", async () => {
    const supabase = mockSupabase({
      rpc: { match_knowledge: [matchRow({ source_id: "p1" }), matchRow({ source_id: "p2" })] },
      products: [productRow({ id: "p1" }), productRow({ id: "p2" })],
    });

    await searchProducts("laptop", {}, supabase);

    expect(supabase.filters("products")).toContainEqual({ method: "in", args: ["id", ["p1", "p2"]] });
    expect(supabase.filters("products")).toContainEqual({ method: "eq", args: ["is_active", true] });
  });

  it("conserva el orden por similitud del RPC, no el que devuelva products", async () => {
    const supabase = mockSupabase({
      rpc: {
        match_knowledge: [
          matchRow({ source_id: "segundo", similarity: 0.9 }),
          matchRow({ source_id: "primero", similarity: 0.5 }),
        ],
      },
      // products los devuelve en el orden inverso al del ranking.
      products: [productRow({ id: "primero" }), productRow({ id: "segundo" })],
    });

    const results = await searchProducts("laptop", {}, supabase);

    expect(results.map((result) => result.product.id)).toEqual(["segundo", "primero"]);
  });

  it("propaga el error al hidratar", async () => {
    const supabase = mockSupabase({
      rpc: { match_knowledge: [matchRow()] },
      products: fail(pgError("denied", "42501")),
    });

    await expect(searchProducts("laptop", {}, supabase)).rejects.toMatchObject({ code: "42501" });
  });
});
