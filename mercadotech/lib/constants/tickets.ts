import type { TicketStatus } from "@/lib/constants/roles";

// Mismo patrón que lib/constants/orders.ts para OrderStatus: etiquetas y
// clases de color en un solo lugar, sobre los tokens semánticos de
// globals.css — nunca colores hardcodeados.
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
};

export const TICKET_STATUS_CLASSES: Record<TicketStatus, string> = {
  abierto: "bg-info/10 text-info",
  en_proceso: "bg-info/10 text-info",
  resuelto: "bg-success/10 text-success",
  cerrado: "bg-muted text-muted-foreground",
};
