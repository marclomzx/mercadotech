"use client";

import {
  DndContext,
  KeyboardSensor,
  KeyboardCode,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";

import { OrderKanbanCard } from "@/components/seller/OrderKanbanCard";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS } from "@/lib/constants/orders";
import type { OrderStatus } from "@/lib/constants/roles";
import { cn } from "@/lib/utils";
import type { SellerOrder } from "@/types/order";

type OrdersKanbanProps = {
  orders: SellerOrder[];
  onMove: (orderId: string, toStatus: OrderStatus) => void;
};

// DRAG & DROP #2. Columnas del flujo + "Cancelado" aparte, de SOLO LECTURA:
// la RLS del vendedor no permite poner 'cancelado' (solo el comprador
// cancela, y solo si está pendiente), así que esa columna no acepta drops.
const READONLY_STATUS: OrderStatus = "cancelado";

// Sin esto, el KeyboardSensor por defecto mueve la tarjeta en incrementos de
// píxeles, que no caen de forma fiable dentro de una columna: el usuario de
// teclado no podría soltar donde quiere. Este getter salta al CENTRO de la
// columna vecina con ←/→, que es la unidad real de este tablero.
const columnCoordinateGetter: KeyboardCoordinateGetter = (
  event,
  { context: { droppableContainers, collisionRect } },
) => {
  if (!collisionRect) return undefined;
  if (event.code !== KeyboardCode.Right && event.code !== KeyboardCode.Left) return undefined;

  event.preventDefault();
  const direction = event.code === KeyboardCode.Right ? 1 : -1;

  // Columnas ordenadas por posición horizontal en pantalla.
  const columns = [...droppableContainers.values()]
    .filter((container) => container.rect.current)
    .sort((a, b) => a.rect.current!.left - b.rect.current!.left);

  const currentIndex = columns.findIndex(
    (column) => column.rect.current!.left > collisionRect.left - column.rect.current!.width / 2,
  );
  const target = columns[Math.max(0, Math.min(columns.length - 1, currentIndex + direction))];
  if (!target?.rect.current) return undefined;

  return {
    x: target.rect.current.left + target.rect.current.width / 2 - collisionRect.width / 2,
    y: collisionRect.top,
  };
};

export function OrdersKanban({ orders, onMove }: OrdersKanbanProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnCoordinateGetter }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const toStatus = over.id as OrderStatus;
    // Se ignora el drop en la columna de solo lectura antes de siquiera
    // consultar al hook.
    if (toStatus === READONLY_STATUS) return;

    onMove(String(active.id), toStatus);
  }

  const columns: OrderStatus[] = [...ORDER_STATUS_FLOW, READONLY_STATUS];

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Pedido ${String(active.id).slice(0, 8)} tomado.`,
          onDragOver: ({ active, over }) =>
            over
              ? `Pedido ${String(active.id).slice(0, 8)} sobre la columna ${ORDER_STATUS_LABELS[over.id as OrderStatus]}.`
              : "",
          onDragEnd: ({ active, over }) =>
            over
              ? `Pedido ${String(active.id).slice(0, 8)} soltado en ${ORDER_STATUS_LABELS[over.id as OrderStatus]}.`
              : `Pedido ${String(active.id).slice(0, 8)} soltado fuera de una columna.`,
          onDragCancel: ({ active }) =>
            `Movimiento del pedido ${String(active.id).slice(0, 8)} cancelado.`,
        },
      }}
    >
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {columns.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            orders={orders.filter((order) => order.status === status)}
            readOnly={status === READONLY_STATUS}
          />
        ))}
      </div>
    </DndContext>
  );
}

type KanbanColumnProps = {
  status: OrderStatus;
  orders: SellerOrder[];
  readOnly: boolean;
};

function KanbanColumn({ status, orders, readOnly }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: readOnly });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-3 rounded-lg border p-3",
        isOver && !readOnly && "border-primary bg-primary/5",
        readOnly && "bg-muted/30",
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{ORDER_STATUS_LABELS[status]}</h2>
        <span className="text-xs text-muted-foreground">{orders.length}</span>
      </div>

      {readOnly && (
        <p className="text-xs text-muted-foreground">
          Solo lectura: cancela el comprador.
        </p>
      )}

      <div className="space-y-2">
        {orders.map((order) => (
          <OrderKanbanCard
            key={order.id}
            order={order}
            draggable={!readOnly}
            statusLabel={ORDER_STATUS_LABELS[status]}
          />
        ))}
      </div>
    </div>
  );
}
