import { Skeleton } from "@/components/ui/skeleton";

// Burbuja del asistente mientras espera la respuesta. Reutiliza Skeleton
// (sesión 3) para el indicador de "escribiendo…" en vez de inventar una
// animación nueva.
export function LoadingMessage() {
  return (
    <div className="flex justify-start">
      <div
        className="flex items-center gap-1 rounded-2xl rounded-bl-sm border bg-card px-3.5 py-3"
        role="status"
        aria-label="El asistente está escribiendo"
      >
        <Skeleton className="size-1.5 rounded-full" />
        <Skeleton className="size-1.5 rounded-full [animation-delay:150ms]" />
        <Skeleton className="size-1.5 rounded-full [animation-delay:300ms]" />
      </div>
    </div>
  );
}
