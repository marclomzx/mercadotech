import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// numeric(12,2) (price, total, price_snapshot) llega como string desde
// PostgREST para no perder precisión con floats — de ahí el `number | string`.
export function formatPrice(value: number | string): string {
  const amount = typeof value === "string" ? Number(value) : value
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(amount)
}
