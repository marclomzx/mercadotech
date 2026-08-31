"use client";

import { useState, type FormEvent } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { RatingStars } from "@/components/shared/RatingStars";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Review } from "@/types/review";

type ReviewsSectionProps = {
  reviews: Review[];
  average: number;
  count: number;
  canReview: boolean;
  onSubmit: (rating: number, comment: string) => Promise<void>;
};

// Igual que en preguntas: sin nombres de terceros (profiles no es legible
// para otros usuarios), se muestra "Comprador verificado" — el "verificado"
// es literal: la RLS ya exigió un pedido 'entregado' con este producto para
// poder insertar la reseña.
export function ReviewsSection({ reviews, average, count, canReview, onSubmit }: ReviewsSectionProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(rating, comment.trim());
      setComment("");
      setRating(5);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Reseñas</h2>
        {count > 0 && (
          <>
            <RatingStars value={average} size="sm" />
            <span className="text-sm text-muted-foreground">
              {average.toFixed(1)} ({count})
            </span>
          </>
        )}
      </div>

      {/* Solo aparece si canReview.allowed es true (defensa en profundidad:
          la RLS igual lo exigiría en el INSERT aunque este form no existiera). */}
      {canReview && (
        <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">Deja tu reseña</p>
          <RatingStars value={rating} onChange={setRating} />
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Cuéntanos tu experiencia (opcional)"
            aria-label="Tu comentario"
          />
          <Button type="submit" size="sm" disabled={submitting}>
            Publicar reseña
          </Button>
        </form>
      )}

      {reviews.length === 0 ? (
        <EmptyState title="Todavía no hay reseñas" />
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className="space-y-1 border-b pb-3 last:border-0">
              <div className="flex items-center gap-2">
                <RatingStars value={review.rating} size="sm" />
                <span className="text-xs text-muted-foreground">
                  Comprador verificado ·{" "}
                  {new Date(review.created_at).toLocaleDateString("es-PE")}
                </span>
              </div>
              {review.comment && <p className="text-sm">{review.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
