"use client";

import { useCallback, useEffect, useState } from "react";

import * as favoriteService from "@/services/favorite.service";

// Estado del corazón de UN producto (BuyBox del detalle). Para el listado
// completo de /favoritos, ver useFavorites.
export function useFavorite(productId: string, userId: string | null) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setIsFavorite(false);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    favoriteService
      .isFavorite(userId, productId)
      .then((value) => {
        if (active) setIsFavorite(value);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId, userId]);

  const toggle = useCallback(async () => {
    if (!userId) return;
    const next = await favoriteService.toggle(userId, productId, isFavorite);
    setIsFavorite(next);
  }, [userId, productId, isFavorite]);

  return { isFavorite, loading, toggle };
}
