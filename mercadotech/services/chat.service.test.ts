import { beforeEach, describe, expect, it, vi } from "vitest";

// DECISIÓN 7 (mockeo de dos niveles), aplicada al orquestador:
//   - Supabase se INYECTA (el RPC match_knowledge responde desde el mock).
//   - lib/ai/embeddings y lib/ai/completion se mockean POR MÓDULO: son las
//     dos únicas puertas a la red y chat.service las alcanza a través de
//     vector-search, sin parámetro por donde sustituirlas.
// vector-search.service y context-builder NO se mockean: son los eslabones
// reales de la cadena que este test quiere verificar.
vi.mock("@/lib/ai/embeddings", () => ({ generateEmbedding: vi.fn() }));
vi.mock("@/lib/ai/completion", () => ({ generateCompletion: vi.fn() }));

import { generateCompletion } from "@/lib/ai/completion";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { SHOPPING_SYSTEM_INSTRUCTIONS, SUPPORT_SYSTEM_INSTRUCTIONS } from "@/lib/ai/prompts";
import { ask } from "@/services/chat.service";
import { fail, mockSupabase, pgError } from "@/services/test-utils/supabase-mock";

const COMPLETION = {
  text: "Te recomiendo la Laptop Gamer [1].",
  model: "meta-llama/Llama-3.1-8B-Instruct",
  stopReason: "stop",
};

beforeEach(() => {
  vi.mocked(generateEmbedding).mockReset().mockResolvedValue([0.1, 0.2]);
  vi.mocked(generateCompletion).mockReset().mockResolvedValue(COMPLETION);
});

function matchRow(overrides: Record<string, unknown> = {}) {
  return {
    source_type: "producto",
    source_id: "p1",
    content: "Laptop Gamer con 16GB de RAM y tarjeta dedicada, ideal para juegos.",
    metadata: { title: "Laptop Gamer", price: 1500 },
    similarity: 0.8,
    ...overrides,
  };
}

describe("ask — orquestación", () => {
  it("encadena búsqueda → contexto → completion, en ese orden", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [matchRow()] } });

    await ask("¿qué laptop me recomiendas?", "compras", {}, supabase);

    // 1. Búsqueda: la consulta se vectorizó y fue al RPC.
    expect(generateEmbedding).toHaveBeenCalledWith("¿qué laptop me recomiendas?");
    expect(supabase.rpcCalls()).toHaveLength(1);

    // 2 y 3. El contexto real (buildContext) se armó ANTES de redactar: el
    // mensaje que recibió la completion trae la fuente numerada y la pregunta.
    const [, userMessage] = vi.mocked(generateCompletion).mock.calls[0];
    expect(userMessage).toContain("[1] Laptop Gamer");
    expect(userMessage).toContain("PREGUNTA: ¿qué laptop me recomiendas?");

    // El orden de invocación es global y monotónico en Vitest.
    expect(vi.mocked(generateEmbedding).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(generateCompletion).mock.invocationCallOrder[0],
    );
  });

  it("modo compras: busca en fichas de producto con las instrucciones de compras", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [matchRow()] } });

    await ask("laptop", "compras", {}, supabase);

    expect(supabase.rpcCalls()[0].args).toMatchObject({ p_source_type: "producto" });
    expect(vi.mocked(generateCompletion).mock.calls[0][0]).toBe(SHOPPING_SYSTEM_INSTRUCTIONS);
  });

  it("modo soporte: busca en artículos con las instrucciones de soporte", async () => {
    const supabase = mockSupabase({
      rpc: { match_knowledge: [matchRow({ source_type: "articulo_soporte" })] },
    });

    await ask("¿cómo devuelvo?", "soporte", {}, supabase);

    expect(supabase.rpcCalls()[0].args).toMatchObject({ p_source_type: "articulo_soporte" });
    expect(vi.mocked(generateCompletion).mock.calls[0][0]).toBe(SUPPORT_SYSTEM_INSTRUCTIONS);
  });

  it("pasa topK y similarityThreshold a la búsqueda", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [] } });

    await ask("laptop", "compras", { topK: 3, similarityThreshold: 0.6 }, supabase);

    expect(supabase.rpcCalls()[0].args).toMatchObject({
      match_count: 3,
      similarity_threshold: 0.6,
    });
  });
});

describe("ask — hasRelevantContext", () => {
  it("true cuando el builder seleccionó al menos una fuente", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [matchRow()] } });

    const result = await ask("laptop", "compras", {}, supabase);

    expect(result.hasRelevantContext).toBe(true);
    expect(result.sources).toHaveLength(1);
  });

  // Comportamiento de la sesión 4: sin contexto NO se cortocircuita. La
  // completion se llama igual, con el mensaje que dice explícitamente que no
  // hubo información — así el asistente suena igual al fallar que al acertar.
  it("false cuando el builder no seleccionó fuentes — y la completion SE LLAMA igual", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [] } });

    const result = await ask("¿venden autos usados?", "compras", {}, supabase);

    expect(result.hasRelevantContext).toBe(false);
    expect(result.sources).toEqual([]);
    expect(generateCompletion).toHaveBeenCalledTimes(1);
    expect(vi.mocked(generateCompletion).mock.calls[0][1]).toContain(
      "No se encontró información relevante",
    );
    expect(result.answer).toBe(COMPLETION.text);
  });

  it("false también cuando se recuperaron fichas pero el builder las filtró todas", async () => {
    const supabase = mockSupabase({
      // Similitud por debajo del mínimo que aplica el context-builder.
      rpc: { match_knowledge: [matchRow({ similarity: 0.05 })] },
    });

    const result = await ask("laptop", "compras", {}, supabase);

    expect(result.hasRelevantContext).toBe(false);
    // retrievedCount ≠ usedSourceCount: se recuperó 1, se usó 0.
    expect(result.metadata.retrievedCount).toBe(1);
    expect(result.metadata.usedSourceCount).toBe(0);
    expect(generateCompletion).toHaveBeenCalledTimes(1);
  });
});

describe("ask — resultado", () => {
  it("devuelve la query, la respuesta del modelo y las fuentes con su metadata original", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: [matchRow()] } });

    const result = await ask("laptop", "compras", {}, supabase);

    expect(result.query).toBe("laptop");
    expect(result.answer).toBe(COMPLETION.text);
    expect(result.sources[0]).toEqual({
      sourceType: "producto",
      sourceId: "p1",
      title: "Laptop Gamer",
      similarity: 0.8,
      // La metadata la recupera del match, no del contexto.
      metadata: { title: "Laptop Gamer", price: 1500 },
    });
  });

  it("metadata: modelo del proveedor, recuperadas vs usadas y truncado", async () => {
    const supabase = mockSupabase({
      rpc: { match_knowledge: [matchRow(), matchRow({ source_id: "p2" })] },
    });

    const result = await ask("laptop", "compras", {}, supabase);

    expect(result.metadata).toEqual({
      model: COMPLETION.model,
      retrievedCount: 2,
      usedSourceCount: 2,
      contextTruncated: false,
    });
  });

  it("respeta maxSources del builder: se recuperan más fuentes de las que se usan", async () => {
    const supabase = mockSupabase({
      rpc: {
        match_knowledge: [
          matchRow({ source_id: "p1", similarity: 0.9 }),
          matchRow({ source_id: "p2", similarity: 0.8 }),
          matchRow({ source_id: "p3", similarity: 0.7 }),
        ],
      },
    });

    const result = await ask("laptop", "compras", { maxSources: 2 }, supabase);

    expect(result.metadata.retrievedCount).toBe(3);
    expect(result.metadata.usedSourceCount).toBe(2);
    expect(result.sources.map((source) => source.sourceId)).toEqual(["p1", "p2"]);
  });
});

describe("ask — errores", () => {
  it("propaga el error de la búsqueda sin llamar a la completion", async () => {
    const supabase = mockSupabase({ rpc: { match_knowledge: fail(pgError("denied", "42501")) } });

    await expect(ask("laptop", "compras", {}, supabase)).rejects.toMatchObject({ code: "42501" });
    expect(generateCompletion).not.toHaveBeenCalled();
  });

  it("propaga el error del proveedor de embeddings", async () => {
    vi.mocked(generateEmbedding).mockRejectedValue(new Error("provider_down"));
    const supabase = mockSupabase();

    await expect(ask("laptop", "compras", {}, supabase)).rejects.toThrow("provider_down");
  });

  it("propaga el error de la completion (la búsqueda ya había ocurrido)", async () => {
    vi.mocked(generateCompletion).mockRejectedValue(new Error("HTTP 503: modelo sin proveedor"));
    const supabase = mockSupabase({ rpc: { match_knowledge: [matchRow()] } });

    await expect(ask("laptop", "compras", {}, supabase)).rejects.toThrow(
      "HTTP 503: modelo sin proveedor",
    );
    expect(supabase.rpcCalls()).toHaveLength(1);
  });
});
