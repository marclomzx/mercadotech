import { afterEach, describe, expect, it, vi } from "vitest";

import { triggerReindex } from "@/services/indexing-trigger.service";

// Este service no recibe cliente de Supabase: su única dependencia es `fetch`
// global, así que se sustituye con vi.stubGlobal (no es un vi.mock de módulo:
// la regla de la decisión 7 sigue intacta).
//
// REGLA del módulo que estos tests custodian: jamás puede lanzar ni retrasar
// la operación principal — todo error termina en console.warn.

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Espera a que la cadena fire-and-forget termine sus microtasks. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("triggerReindex", () => {
  it("hace POST a /api/v1/reindex con la fuente a refichar", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    triggerReindex("producto", "p1");
    await flush();

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/reindex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceType: "producto", sourceId: "p1" }),
    });
  });

  it("no devuelve promesa: el llamador sigue de largo sin esperar", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    expect(triggerReindex("producto", "p1")).toBeUndefined();
  });

  it("respuesta ok: no avisa nada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    triggerReindex("producto", "p1");
    await flush();

    expect(warn).not.toHaveBeenCalled();
  });

  it("respuesta con error: avisa con el mensaje real del endpoint, sin lanzar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: "HUGGINGFACEHUB_API_TOKEN no está configurada" } }),
      }),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => triggerReindex("producto", "p1")).not.toThrow();
    await flush();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("HUGGINGFACEHUB_API_TOKEN no está configurada"),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("La publicación sí se guardó"));
  });

  it("cuerpo ilegible: cae al status HTTP como mensaje", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error("not json");
        },
      }),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    triggerReindex("articulo_soporte", "a1");
    await flush();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("HTTP 502"));
  });

  it("falla de red: avisa que no se contactó el endpoint, sin lanzar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Failed to fetch")));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => triggerReindex("producto", "p1")).not.toThrow();
    await flush();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("No se pudo contactar al endpoint de indexación"),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Failed to fetch"));
  });
});
