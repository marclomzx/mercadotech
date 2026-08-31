"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { Price } from "@/components/shared/Price";
import type { SellerOrder } from "@/types/order";
import { cn } from "@/lib/utils";

type OrderKanbanCardProps = {
  order: SellerOrder;
  draggable: boolean;
  statusLabel: string;
};

// Muestra SOLO los ítems de este vendedor y el total de ESOS ítems
// (order.myTotal), no orders.total: en un pedido multi-vendedor el total
// global incluye lo que vendió el otro y sería engañoso.
//
// Limitación conocida del modelo: mover la tarjeta cambia el estado del
// PEDIDO COMPLETO, no solo de los ítems propios — orders.status es una
// única columna compartida por todos los vendedores del pedido.
export function OrderKanbanCard({ order, draggable, statusLabel }: OrderKanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    disabled: !draggable,
  });

  // Nombre accesible conciso: sin esto, dnd-kit marca la tarjeta como
  // role="button" y el lector de pantalla leería todo el contenido suelto
  // (id, fecha, cada ítem, el total) sin decir qué es ni en qué columna está.
  const label = `Pedido ${order.id.slice(0, 8)}, ${statusLabel}, ${order.myItems.length} ${
    order.myItems.length === 1 ? "ítem" : "ítems"
  }`;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "space-y-2 rounded-lg border bg-card p-3",
        draggable && "cursor-grab",
        isDragging && "z-10 opacity-70",
      )}
      aria-label={draggable ? `${label}. Arrastra o usa las flechas para avanzarlo.` : label}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs">#{order.id.slice(0, 8)}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(order.created_at).toLocaleDateString("es-PE")}
        </span>
      </div>

      <ul className="space-y-0.5">
        {order.myItems.map((item) => (
          <li key={item.id} className="line-clamp-1 text-xs text-muted-foreground">
            {item.quantity}× {item.title_snapshot}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t pt-2">
        <span className="text-xs text-muted-foreground">Mis ítems</span>
        <Price value={order.myTotal} size="sm" />
      </div>
    </div>
  );
}
