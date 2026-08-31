"use client";

import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

type RatingStarsProps = {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

const SIZE_CLASSES: Record<NonNullable<RatingStarsProps["size"]>, string> = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
};

// Modo solo lectura (sin onChange): estrellas informativas, sin foco de
// teclado. Modo editable (con onChange): cada estrella es un <button>, así
// que Tab/Enter/Espacio funcionan sin JS extra para el foco.
export function RatingStars({
  value,
  onChange,
  size = "md",
  className,
}: RatingStarsProps) {
  const starSize = SIZE_CLASSES[size];

  if (!onChange) {
    return (
      <div
        className={cn("inline-flex items-center gap-0.5", className)}
        role="img"
        aria-label={`${value} de 5 estrellas`}
      >
        {STAR_VALUES.map((star) => (
          <Star
            key={star}
            aria-hidden="true"
            className={cn(
              starSize,
              star <= Math.round(value)
                ? "fill-warning text-warning"
                : "fill-none text-muted-foreground",
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      {STAR_VALUES.map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`Calificar con ${star} de 5 estrellas`}
          aria-pressed={star <= value}
          onClick={() => onChange(star)}
          className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Star
            aria-hidden="true"
            className={cn(
              starSize,
              star <= value
                ? "fill-warning text-warning"
                : "fill-none text-muted-foreground",
            )}
          />
        </button>
      ))}
    </div>
  );
}
