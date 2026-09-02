import { describe, expect, it } from "vitest";

import { answer, create, listByProduct } from "@/services/question.service";
import { fail, mockSupabase, pgError } from "@/services/test-utils/supabase-mock";

describe("listByProduct", () => {
  it("filtra por producto y ordena por fecha descendente", async () => {
    const supabase = mockSupabase({ questions: [{ id: "q1", question: "¿Tiene garantía?" }] });

    const questions = await listByProduct("p1", supabase);

    expect(questions).toHaveLength(1);
    expect(supabase.filters("questions")).toEqual([
      { method: "eq", args: ["product_id", "p1"] },
      { method: "order", args: ["created_at", { ascending: false }] },
    ]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ questions: fail(pgError("boom")) });

    await expect(listByProduct("p1", supabase)).rejects.toMatchObject({ message: "boom" });
  });
});

describe("create", () => {
  it("inserta la pregunta con product_id y user_id", async () => {
    const supabase = mockSupabase({ questions: { single: { id: "q1" } } });

    await create("p1", "u1", "¿Incluye cargador?", supabase);

    expect(supabase.inserts("questions")).toEqual([
      { product_id: "p1", user_id: "u1", question: "¿Incluye cargador?" },
    ]);
  });

  it("propaga el error de la RLS", async () => {
    const supabase = mockSupabase({ questions: { insert: fail(pgError("permission denied", "42501")) } });

    await expect(create("p1", "u1", "¿?", supabase)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("answer", () => {
  it("envía SOLO answer y answered_at (defensa en profundidad: no hay trigger que lo limite)", async () => {
    const supabase = mockSupabase({ questions: { single: { id: "q1" } } });

    await answer("q1", "Sí, incluye cargador.", supabase);

    const payload = supabase.updates("questions")[0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["answer", "answered_at"]);
    expect(payload.answer).toBe("Sí, incluye cargador.");
    expect(typeof payload.answered_at).toBe("string");
    expect(supabase.filters("questions")).toContainEqual({ method: "eq", args: ["id", "q1"] });
  });

  it("answered_at es una fecha ISO válida", async () => {
    const supabase = mockSupabase({ questions: { single: { id: "q1" } } });

    await answer("q1", "Sí.", supabase);

    const { answered_at: answeredAt } = supabase.updates("questions")[0] as { answered_at: string };
    expect(new Date(answeredAt).toISOString()).toBe(answeredAt);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ questions: { update: fail(pgError("denied", "42501")) } });

    await expect(answer("q1", "Sí.", supabase)).rejects.toMatchObject({ code: "42501" });
  });
});
