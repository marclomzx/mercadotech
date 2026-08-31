"use client";

import { useCallback, useEffect, useState } from "react";

import * as reviewService from "@/services/review.service";
import type { CanReviewResult } from "@/services/review.service";
import type { Review } from "@/types/review";

const NOT_ALLOWED: CanReviewResult = { allowed: false, orderId: null };

export function useReviews(productId: string, userId: string | null) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [canReview, setCanReview] = useState<CanReviewResult>(NOT_ALLOWED);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      reviewService.listByProduct(productId),
      reviewService.getAverage(productId),
      userId ? reviewService.canReview(productId, userId) : Promise.resolve(NOT_ALLOWED),
    ])
      .then(([reviewsData, averageData, canReviewData]) => {
        setReviews(reviewsData);
        setAverage(averageData.average);
        setCount(averageData.count);
        setCanReview(canReviewData);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "No se pudieron cargar las reseñas.");
      })
      .finally(() => setLoading(false));
  }, [productId, userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const submit = useCallback(
    async (params: { buyerId: string; rating: number; comment?: string }) => {
      // Defensa en profundidad: aunque el formulario solo se muestra cuando
      // canReview.allowed es true, se revalida acá antes de armar el
      // insert — el server (RLS) igual lo exigiría de todos modos.
      if (!canReview.allowed || !canReview.orderId) {
        throw new Error("No puedes reseñar este producto todavía.");
      }
      const created = await reviewService.create({
        productId,
        buyerId: params.buyerId,
        orderId: canReview.orderId,
        rating: params.rating,
        comment: params.comment,
      });
      // Recarga completa: recalcula promedio/count con el dato real y
      // vuelve a poner canReview en false (ya no puede reseñar dos veces).
      await fetchAll();
      return created;
    },
    [canReview, productId, fetchAll],
  );

  return { reviews, average, count, canReview, loading, error, submit, retry: fetchAll };
}
