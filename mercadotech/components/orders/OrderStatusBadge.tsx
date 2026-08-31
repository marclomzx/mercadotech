import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_CLASSES, ORDER_STATUS_LABELS } from "@/lib/constants/orders";
import type { OrderStatus } from "@/lib/constants/roles";
import { cn } from "@/lib/utils";

type OrderStatusBadgeProps = {
  status: OrderStatus;
  className?: string;
};

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", ORDER_STATUS_CLASSES[status], className)}
    >
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}
