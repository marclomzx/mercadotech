import { Badge } from "@/components/ui/badge";
import type { ProductCondition } from "@/lib/constants/roles";
import { cn } from "@/lib/utils";

type ConditionBadgeProps = {
  condition: ProductCondition;
  className?: string;
};

const CONDITION_LABELS: Record<ProductCondition, string> = {
  nuevo: "Nuevo",
  usado: "Usado",
  reacondicionado: "Reacondicionado",
};

// Fondo tintado + texto del color (mismo patrón que la variante
// "destructive" de components/ui/badge.tsx), siempre vía tokens de
// globals.css — nunca un color hardcodeado acá.
const CONDITION_CLASSES: Record<ProductCondition, string> = {
  nuevo: "bg-success/10 text-success",
  reacondicionado: "bg-info/10 text-info",
  usado: "bg-warning/10 text-warning",
};

export function ConditionBadge({ condition, className }: ConditionBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", CONDITION_CLASSES[condition], className)}
    >
      {CONDITION_LABELS[condition]}
    </Badge>
  );
}
