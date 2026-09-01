import { TicketStatusBadge } from "@/components/shared/TicketStatusBadge";
import type { Ticket } from "@/types/ticket";

type TicketCardProps = {
  ticket: Ticket;
};

// Mismo patrón que OrderCard, sin link: no hay página de detalle de ticket
// en el alcance de esta fase (el chat de mensajes por ticket llega con el
// agente de la sesión 8) — es una lista de solo lectura.
export function TicketCard({ ticket }: TicketCardProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <div className="min-w-0 space-y-1">
        <p className="line-clamp-1 text-sm font-medium">{ticket.subject}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(ticket.created_at).toLocaleDateString("es-PE")}
        </p>
      </div>
      <TicketStatusBadge status={ticket.status} />
    </div>
  );
}
