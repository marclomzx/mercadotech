import type { OrderStatus } from "@/lib/constants/roles";

// Secuencia de cumplimiento del pedido. 'cancelado' NO está acá a propósito:
// no es un paso del flujo sino una salida lateral, y la RLS del vendedor
// (orders_update_seller_advance_status) solo acepta pagado/enviado/entregado.
// El kanban de la Fase 3.7 usa este arreglo para validar transiciones.
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "pendiente",
  "pagado",
  "enviado",
  "entregado",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

// Clases de color por estado, sobre los tokens semánticos de globals.css
// (Fase 3.1) — nunca colores hardcodeados. Gris = inerte (pendiente/cancelado),
// info = en curso, success = completado.
export const ORDER_STATUS_CLASSES: Record<OrderStatus, string> = {
  pendiente: "bg-muted text-muted-foreground",
  pagado: "bg-info/10 text-info",
  enviado: "bg-info/10 text-info",
  entregado: "bg-success/10 text-success",
  cancelado: "bg-destructive/10 text-destructive",
};
