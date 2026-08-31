import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type LoadingStateProps = {
  lines?: number;
  className?: string;
};

// Placeholder genérico de líneas. Pantallas concretas (ej. grid de
// productos en 3.4) arman su propio skeleton con esta forma, no la
// reemplazan por un spinner.
export function LoadingState({ lines = 3, className }: LoadingStateProps) {
  return (
    <div className={cn("space-y-3", className)} role="status" aria-label="Cargando">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className="h-4 w-full" />
      ))}
    </div>
  );
}
