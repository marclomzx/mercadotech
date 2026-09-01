import type { Database } from "@/types/database";
import type { TicketStatus } from "@/lib/constants/roles";

// `status` se acota al union type de lib/constants/roles.ts, igual que
// Order con OrderStatus — mismo patrón, sin conversión numérica porque
// support_tickets no tiene columnas numeric.
export type Ticket = Omit<
  Database["public"]["Tables"]["support_tickets"]["Row"],
  "status"
> & {
  status: TicketStatus;
};
