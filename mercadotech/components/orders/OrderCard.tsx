import Link from "next/link";

import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { Price } from "@/components/shared/Price";
import type { Order } from "@/types/order";

type OrderCardProps = {
  order: Order;
};

export function OrderCard({ order }: OrderCardProps) {
  return (
    <Link
      href={`/pedidos/${order.id}`}
      className="flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors hover:border-primary"
      data-testid={`order-card-${order.id}`}
    >
      <div className="space-y-1">
        {/* Id corto: el uuid completo no aporta nada al comprador. */}
        <p className="font-mono text-sm">#{order.id.slice(0, 8)}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(order.created_at).toLocaleDateString("es-PE")}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <OrderStatusBadge status={order.status} />
        <Price value={order.total} />
      </div>
    </Link>
  );
}
