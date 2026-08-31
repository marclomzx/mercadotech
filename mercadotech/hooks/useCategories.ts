"use client";

import { useEffect, useState } from "react";

import * as categoryService from "@/services/category.service";
import type { Database } from "@/types/database";

type Category = Database["public"]["Tables"]["categories"]["Row"];

// Cache simple en memoria a nivel de módulo: las categorías cambian con muy
// poca frecuencia, así que mientras dure la pestaña no hace falta volver a
// pedirlas cada vez que se monta el navbar en una navegación distinta.
let cache: Category[] | null = null;

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    let active = true;

    categoryService
      .listCategories()
      .then((data) => {
        if (!active) return;
        cache = data;
        setCategories(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "No se pudieron cargar las categorías.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { categories, loading, error };
}
