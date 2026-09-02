import { describe, expect, it } from "vitest";

import { cn, formatPrice } from "@/lib/utils";

describe("cn", () => {
  it("combina clases simples separadas por espacio", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("resuelve conflictos de Tailwind quedándose con la última clase", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("descarta valores falsy (clases condicionales)", () => {
    expect(cn("base", false && "oculta", undefined, null, "visible")).toBe("base visible");
  });

  it("acepta arrays y objetos, como clsx", () => {
    expect(cn(["a", "b"], { c: true, d: false })).toBe("a b c");
  });
});

describe("formatPrice", () => {
  // "golden": se compara contra el mismo formateador de Intl que usa la
  // función, en vez de copiar a mano el string con S/ y espacios especiales
  // (frágil entre entornos) — lo que se prueba es la conversión number|string,
  // no la tabla ICU de es-PE.
  const golden = (value: number) =>
    new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value);

  it("formatea 0", () => {
    expect(formatPrice(0)).toBe(golden(0));
  });

  it("redondea a 2 decimales", () => {
    expect(formatPrice(1234.567)).toBe(golden(1234.567));
  });

  it("aplica separador de miles", () => {
    expect(formatPrice(12345)).toBe(golden(12345));
  });

  it("acepta una entrada number", () => {
    expect(formatPrice(219)).toBe(golden(219));
  });

  it('acepta una entrada string, como "219.00" llega desde PostgREST', () => {
    expect(formatPrice("219.00")).toBe(golden(219));
  });

  it("string y number del mismo valor producen el mismo resultado", () => {
    expect(formatPrice("1234.50")).toBe(formatPrice(1234.5));
  });
});
