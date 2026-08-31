"use client";

import { useRouter } from "next/navigation";

import { OrderCard } from "@/components/orders/OrderCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useOrders } from "@/hooks/useOrders";

export function OrdersView() {
  const router = useRouter();
  const { user } = useAuth();
  const { orders, loading, error, retry } = useOrders(user?.id ?? null);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Mis pedidos</h1>

      {loading ? (
        <LoadingState lines={4} />
      ) : error ? (
        <ErrorState onRetry={retry} />
      ) : orders.length === 0 ? (
        <EmptyState
          title="Todavía no tienes pedidos"
          description="Cuando compres algo, aparecerá aquí."
          action={<Button onClick={() => router.push("/")}>Explorar productos</Button>}
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
