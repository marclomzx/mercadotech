import { describe, expect, it } from "vitest";

import { buildContext, type ContextCandidate } from "@/lib/ai/context-builder";
import { buildRagUserMessage } from "@/lib/ai/prompts";
import {
  CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS,
  CONTEXT_BUILDER_DEFAULT_MAX_SOURCES,
  CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY,
  CONTEXT_BUILDER_MIN_CONTENT_LENGTH,
  CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS,
} from "@/lib/constants/ai";

function candidate(overrides: Partial<ContextCandidate> = {}): ContextCandidate {
  return {
    sourceType: "producto",
    sourceId: "id-1",
    content: "Contenido de prueba con longitud suficiente para pasar el filtro mínimo.",
    similarity: 1,
    metadata: { title: "Título de prueba" },
    ...overrides,
  };
}

describe("buildContext — filtro por similitud mínima", () => {
  it("descarta una fuente justo por debajo del umbral y conserva la que lo iguala", () => {
    const below = candidate({
      sourceId: "below",
      similarity: CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY - 0.001,
    });
    const atThreshold = candidate({
      sourceId: "at-threshold",
      similarity: CONTEXT_BUILDER_DEFAULT_MIN_SIMILARITY,
    });

    const result = buildContext("consulta", [below, atThreshold]);

    expect(result.sources.map((s) => s.sourceId)).toEqual(["at-threshold"]);
  });
});

describe("buildContext — filtro por longitud mínima de contenido", () => {
  it("descarta contenido justo por debajo del mínimo y conserva el que lo iguala", () => {
    const tooShort = candidate({
      sourceId: "too-short",
      content: "x".repeat(CONTEXT_BUILDER_MIN_CONTENT_LENGTH - 1),
    });
    const atMin = candidate({
      sourceId: "at-min",
      content: "x".repeat(CONTEXT_BUILDER_MIN_CONTENT_LENGTH),
    });

    const result = buildContext("consulta", [tooShort, atMin]);

    expect(result.sources.map((s) => s.sourceId)).toEqual(["at-min"]);
  });

  it("descarta contenido vacío o solo espacios", () => {
    const blank = candidate({ sourceId: "blank", content: "   " });
    const result = buildContext("consulta", [blank]);
    expect(result.sources).toEqual([]);
  });
});

describe("buildContext — maxSources", () => {
  it(`conserva solo las ${CONTEXT_BUILDER_DEFAULT_MAX_SOURCES} fuentes más similares por default`, () => {
    const candidates = Array.from({ length: CONTEXT_BUILDER_DEFAULT_MAX_SOURCES + 1 }, (_, i) =>
      candidate({ sourceId: `c${i}`, similarity: 0.5 + i * 0.01 }),
    );

    const result = buildContext("consulta", candidates);

    expect(result.sources).toHaveLength(CONTEXT_BUILDER_DEFAULT_MAX_SOURCES);
    // c0 tiene la menor similitud de todas: es la que queda afuera.
    expect(result.sources.map((s) => s.sourceId)).not.toContain("c0");
  });

  it("respeta un maxSources explícito menor al default", () => {
    const candidates = [
      candidate({ sourceId: "a", similarity: 0.9 }),
      candidate({ sourceId: "b", similarity: 0.8 }),
      candidate({ sourceId: "c", similarity: 0.7 }),
    ];

    const result = buildContext("consulta", candidates, { maxSources: 2 });

    expect(result.sources.map((s) => s.sourceId)).toEqual(["a", "b"]);
  });
});

describe("buildContext — orden", () => {
  it("ordena por similitud descendente", () => {
    const candidates = [
      candidate({ sourceId: "low", similarity: 0.4 }),
      candidate({ sourceId: "high", similarity: 0.9 }),
      candidate({ sourceId: "mid", similarity: 0.6 }),
    ];

    const result = buildContext("consulta", candidates);

    expect(result.sources.map((s) => s.sourceId)).toEqual(["high", "mid", "low"]);
  });

  it("conserva el orden de entrada cuando la similitud empata (orden estable)", () => {
    const candidates = [
      candidate({ sourceId: "first", similarity: 0.5 }),
      candidate({ sourceId: "second", similarity: 0.5 }),
      candidate({ sourceId: "third", similarity: 0.5 }),
    ];

    const result = buildContext("consulta", candidates);

    expect(result.sources.map((s) => s.sourceId)).toEqual(["first", "second", "third"]);
  });
});

describe("buildContext — presupuesto de caracteres (CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS)", () => {
  it("incluye una fuente que cabe exacta en el presupuesto, sin truncar", () => {
    const fits = candidate({
      sourceId: "fits",
      content: "x".repeat(CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS),
    });

    const result = buildContext("consulta", [fits]);

    expect(result.stats.contextTruncated).toBe(false);
    expect(result.stats.totalChars).toBe(CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS);
    expect(result.sources[0].content).toHaveLength(CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS);
  });

  it("recorta una fuente que se pasa por 1 carácter del presupuesto, si le queda espacio suficiente", () => {
    const overflow = candidate({
      sourceId: "overflow",
      content: "x".repeat(CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS + 1),
    });

    const result = buildContext("consulta", [overflow]);

    expect(result.stats.contextTruncated).toBe(true);
    expect(result.sources[0].content).toHaveLength(CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS);
  });

  it("recorta la fuente que no cabe y descarta las siguientes: no busca una más chica que sí quepa", () => {
    const first = candidate({
      sourceId: "first",
      similarity: 0.9,
      content: "x".repeat(CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS - 300),
    });
    const second = candidate({
      sourceId: "second",
      similarity: 0.8,
      // No cabe entera en los 300 que quedan, pero sí le alcanza para
      // recortarse (300 >= CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS).
      content: "y".repeat(400),
    });
    const third = candidate({
      sourceId: "third",
      similarity: 0.7,
      // Cabría perfecto en lo que sobra, pero el recorrido ya se detuvo en "second".
      content: "z".repeat(10),
    });

    const result = buildContext("consulta", [first, second, third]);

    expect(result.stats.contextTruncated).toBe(true);
    expect(result.sources.map((s) => s.sourceId)).toEqual(["first", "second"]);
    expect(result.sources[1].content).toHaveLength(300);
    expect(result.stats.totalChars).toBe(CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS - 300 + 300);
  });

  it("descarta ENTERA la fuente que no cabe si el espacio restante queda bajo minTruncatedSourceChars", () => {
    const remaining = CONTEXT_BUILDER_MIN_TRUNCATED_SOURCE_CHARS - 1;
    const first = candidate({
      sourceId: "first",
      similarity: 0.9,
      content: "x".repeat(CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS - remaining),
    });
    const second = candidate({
      sourceId: "second",
      similarity: 0.8,
      content: "y".repeat(500),
    });
    const third = candidate({
      sourceId: "third",
      similarity: 0.7,
      content: "z".repeat(10),
    });

    const result = buildContext("consulta", [first, second, third]);

    expect(result.stats.contextTruncated).toBe(true);
    expect(result.sources.map((s) => s.sourceId)).toEqual(["first"]);
    expect(result.stats.totalChars).toBe(CONTEXT_BUILDER_DEFAULT_MAX_CONTEXT_CHARS - remaining);
  });
});

describe("buildContext — opciones explícitas sobreescriben los defaults", () => {
  it("aplica minSimilarity, minContentLength, maxSources y presupuesto personalizados", () => {
    const candidates: ContextCandidate[] = [
      candidate({ sourceId: "a", similarity: 0.9, content: "a".repeat(20) }),
      candidate({ sourceId: "b", similarity: 0.6, content: "b".repeat(25) }),
      // Filtrada por similitud (0.2 < minSimilarity 0.5).
      candidate({ sourceId: "c", similarity: 0.2, content: "c".repeat(15) }),
      // Filtrada por longitud de contenido (5 < minContentLength 10).
      candidate({ sourceId: "d", similarity: 0.95, content: "corto" }),
    ];

    const result = buildContext("consulta", candidates, {
      minSimilarity: 0.5,
      minContentLength: 10,
      maxSources: 2,
      maxContextChars: 30,
      minTruncatedSourceChars: 3,
    });

    expect(result.sources.map((s) => s.sourceId)).toEqual(["a", "b"]);
    // Presupuesto 30: "a" (20) entra entera; quedan 10 para "b" (25) -> se recorta a 10.
    expect(result.sources[0].content).toHaveLength(20);
    expect(result.sources[1].content).toHaveLength(10);
    expect(result.stats.contextTruncated).toBe(true);
  });
});

describe("buildContext — casos vacíos", () => {
  it("lista vacía: no hay truncado por presupuesto, y arma el mensaje sin fuentes", () => {
    const result = buildContext("¿tienen laptops?", []);

    expect(result.sources).toEqual([]);
    expect(result.stats).toEqual({ contextTruncated: false, totalChars: 0 });
    expect(result.userMessage).toBe(buildRagUserMessage("¿tienen laptops?", []));
  });

  it("todas las fuentes bajo el umbral: se filtran, eso NO es 'truncado'", () => {
    const candidates = [
      candidate({ sourceId: "a", similarity: 0.01 }),
      candidate({ sourceId: "b", similarity: 0.02 }),
    ];

    const result = buildContext("consulta", candidates);

    expect(result.sources).toEqual([]);
    // Filtrado por relevancia, no por presupuesto: son dos señales distintas.
    expect(result.stats.contextTruncated).toBe(false);
  });
});

describe("buildContext — título de la fuente (metadata)", () => {
  it("usa metadata.title recortado cuando es un string válido", () => {
    const result = buildContext("consulta", [
      candidate({ sourceId: "a", metadata: { title: "  Laptop Gamer  " } }),
    ]);
    expect(result.sources[0].title).toBe("Laptop Gamer");
  });

  it("cae a 'Sin título' cuando no hay metadata", () => {
    const result = buildContext("consulta", [candidate({ sourceId: "a", metadata: undefined })]);
    expect(result.sources[0].title).toBe("Sin título");
  });

  it("cae a 'Sin título' cuando metadata es null", () => {
    const result = buildContext("consulta", [candidate({ sourceId: "a", metadata: null })]);
    expect(result.sources[0].title).toBe("Sin título");
  });

  it("cae a 'Sin título' cuando metadata.title está vacío o son solo espacios", () => {
    const result = buildContext("consulta", [
      candidate({ sourceId: "a", metadata: { title: "   " } }),
    ]);
    expect(result.sources[0].title).toBe("Sin título");
  });

  it("cae a 'Sin título' cuando metadata.title no es un string", () => {
    const result = buildContext("consulta", [
      candidate({ sourceId: "a", metadata: { title: 42 } }),
    ]);
    expect(result.sources[0].title).toBe("Sin título");
  });
});

describe("buildContext — userMessage", () => {
  it("delega en buildRagUserMessage con las fuentes seleccionadas, numeradas", () => {
    const candidates = [
      candidate({
        sourceId: "a",
        similarity: 0.9,
        metadata: { title: "Fuente A" },
        content: "Contenido A extendido para pasar el mínimo de longitud.",
      }),
      candidate({
        sourceId: "b",
        similarity: 0.8,
        metadata: { title: "Fuente B" },
        content: "Contenido B extendido para pasar el mínimo de longitud.",
      }),
    ];

    const result = buildContext("¿cuál me recomiendas?", candidates);

    expect(result.userMessage).toBe(
      buildRagUserMessage("¿cuál me recomiendas?", [
        { title: "Fuente A", content: "Contenido A extendido para pasar el mínimo de longitud." },
        { title: "Fuente B", content: "Contenido B extendido para pasar el mínimo de longitud." },
      ]),
    );
  });
});
