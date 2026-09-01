import { Badge } from "@/components/ui/badge";
import { TICKET_STATUS_CLASSES, TICKET_STATUS_LABELS } from "@/lib/constants/tickets";
import type { TicketStatus } from "@/lib/constants/roles";
import { cn } from "@/lib/utils";

type TicketStatusBadgeProps = {
  status: TicketStatus;
  className?: string;
};

// Mismo patrón que OrderStatusBadge (Fase 3.6): un Badge sobre las clases y
// etiquetas centralizadas en lib/constants/tickets.ts.
export function TicketStatusBadge({ status, className }: TicketStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", TICKET_STATUS_CLASSES[status], className)}
    >
      {TICKET_STATUS_LABELS[status]}
    </Badge>
  );
}
