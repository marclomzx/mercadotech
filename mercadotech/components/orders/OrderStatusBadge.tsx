import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_CLASSES, ORDER_STATUS_LABELS } from "@/lib/constants/orders";
import type { OrderStatus } from "@/lib/constants/roles";
import { cn } from "@/lib/utils";

type OrderStatusBadgeProps = {
  status: OrderStatus;
  className?: string;
  "data-testid"?: string;
};

export function OrderStatusBadge({
  status,
  className,
  "data-testid": testId,
}: OrderStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent", ORDER_STATUS_CLASSES[status], className)}
      data-testid={testId}
    >
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}
