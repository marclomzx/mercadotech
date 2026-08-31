import { ShoppingCart } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";

type CartIndicatorProps = {
  count: number;
};

// El contador llega por props — se conecta a useCart() en la Fase 3.6.
export function CartIndicator({ count }: CartIndicatorProps) {
  return (
    <Link
      href="/carrito"
      className="relative inline-flex size-9 items-center justify-center rounded-md hover:bg-muted"
      aria-label={`Carrito, ${count} ${count === 1 ? "producto" : "productos"}`}
    >
      <ShoppingCart className="size-5" aria-hidden="true" />
      {count > 0 && (
        <Badge className="absolute -top-1 -right-1 h-4 min-w-4 justify-center px-1 text-[10px]">
          {count}
        </Badge>
      )}
    </Link>
  );
}
