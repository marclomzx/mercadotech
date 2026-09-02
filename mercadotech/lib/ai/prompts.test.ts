import { describe, expect, it } from "vitest";

import { SUPPORT_SYSTEM_INSTRUCTIONS, buildRagUserMessage } from "@/lib/ai/prompts";

describe("buildRagUserMessage", () => {
  it("sin fuentes: incluye la pregunta y avisa que no hay información relevante", () => {
    const message = buildRagUserMessage("¿venden autos usados?", []);
    expect(message).toContain("PREGUNTA: ¿venden autos usados?");
    expect(message).toContain("No se encontró información relevante");
  });

  it("con fuentes: las numera en orden y conserva la query", () => {
    const message = buildRagUserMessage("¿cuál laptop me recomiendas?", [
      { title: "Laptop Gamer X", content: "16GB RAM, RTX 4060." },
      { title: "Laptop Oficina Y", content: "8GB RAM, sin dedicada." },
    ]);

    expect(message).toContain("PREGUNTA: ¿cuál laptop me recomiendas?");
    expect(message).toContain("[1] Laptop Gamer X\n16GB RAM, RTX 4060.");
    expect(message).toContain("[2] Laptop Oficina Y\n8GB RAM, sin dedicada.");
  });
});

describe("SUPPORT_SYSTEM_INSTRUCTIONS", () => {
  it("incluye la instrucción de sugerir un ticket de soporte", () => {
    expect(SUPPORT_SYSTEM_INSTRUCTIONS).toContain("crear un ticket de soporte");
  });
});
