// Roles de usuario (columna profiles.role). Un solo lugar para el union type
// y el arreglo de valores válidos — evita que el check de la BD y la
// validación de la app se desincronicen.
export const ROLES = ["buyer", "seller", "admin"] as const;
export type Role = (typeof ROLES)[number];

// Estados de un pedido (orders.status).
export const ORDER_STATUSES = [
  "pendiente",
  "pagado",
  "enviado",
  "entregado",
  "cancelado",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Estados de un ticket de soporte (support_tickets.status).
export const TICKET_STATUSES = [
  "abierto",
  "en_proceso",
  "resuelto",
  "cerrado",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

// Condición de un producto (products.condition).
export const PRODUCT_CONDITIONS = ["nuevo", "usado", "reacondicionado"] as const;
export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number];
