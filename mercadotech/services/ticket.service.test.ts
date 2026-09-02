import { describe, expect, it } from "vitest";

import { listMine } from "@/services/ticket.service";
import { fail, mockSupabase, pgError } from "@/services/test-utils/supabase-mock";

describe("listMine", () => {
  it("filtra por user_id y ordena por fecha descendente", async () => {
    const supabase = mockSupabase({
      support_tickets: [
        { id: "t1", user_id: "u1", subject: "Mi pedido no llegó", status: "en_proceso" },
      ],
    });

    const tickets = await listMine("u1", supabase);

    expect(tickets).toHaveLength(1);
    expect(tickets[0].status).toBe("en_proceso");
    expect(supabase.filters("support_tickets")).toEqual([
      { method: "eq", args: ["user_id", "u1"] },
      { method: "order", args: ["created_at", { ascending: false }] },
    ]);
  });

  it("sin tickets devuelve lista vacía", async () => {
    const supabase = mockSupabase({ support_tickets: [] });

    await expect(listMine("u1", supabase)).resolves.toEqual([]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ support_tickets: fail(pgError("denied", "42501")) });

    await expect(listMine("u1", supabase)).rejects.toMatchObject({ code: "42501" });
  });
});
