"use client";

import { useCallback, useState } from "react";

import type { SemanticProductResult } from "@/services/vector-search.service";

type State = {
  results: SemanticProductResult[];
  loading: boolean;
  error: string | null;
  // Distingue "todavía no se buscó nada" de "se buscó y no hubo resultados"
  // — el EmptyState de sin-resultados solo debe aparecer en el segundo caso.
  searched: boolean;
};

const INITIAL_STATE: State = { results: [], loading: false, error: null, searched: false };

// Hook → fetch → endpoint → service → lib/ai/. Este hook NUNCA importa
// lib/ai/ ni el service directamente: solo sabe hacer un POST y traducir la
// respuesta a estado, igual que el resto de hooks del proyecto con sus
// services (regla de capas de la sesión 4).
export function useSemanticSearch() {
  const [state, setState] = useState<State>(INITIAL_STATE);

  const search = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setState(INITIAL_STATE);
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch("/api/v1/search/semantic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error?.message ?? "No se pudo completar la búsqueda.");
      }

      setState({ results: body.results, loading: false, error: null, searched: true });
    } catch (error) {
      setState({
        results: [],
        loading: false,
        error: error instanceof Error ? error.message : "No se pudo completar la búsqueda.",
        searched: true,
      });
    }
  }, []);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { ...state, search, reset };
}
