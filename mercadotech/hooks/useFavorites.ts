"use client";

import { useCallback, useEffect, useState } from "react";

import * as favoriteService from "@/services/favorite.service";
import type { Product } from "@/types/product";

// Lista completa para /favoritos (a diferencia de useFavorite, que solo
// trackea el estado de UN producto).
export function useFavorites(userId: string | null) {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    favoriteService
      .listMine(userId)
      .then(setItems)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "No se pudieron cargar tus favoritos.");
      })
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  return { items, loading, error, retry: fetchFavorites };
}
