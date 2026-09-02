"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSellerOrders } from "@/hooks/useSellerOrders";

// El tablero arrastra @dnd-kit/core y solo se muestra cuando el vendedor ya
// tiene pedidos: con la lista vacía (o cargando, o en error) ese código nunca
// hace falta. ssr:false porque dnd-kit mide rects del DOM real.
const OrdersKanban = dynamic(
  () => import("@/components/seller/OrdersKanban").then((m) => m.OrdersKanban),
  { ssr: false, loading: () => <LoadingState lines={5} /> },
);

export function SellerOrdersView() {
  const { user } = useAuth();
  const { orders, loading, error, move, retry } = useSellerOrders(user?.id ?? null);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pedidos</h1>
      <p className="text-sm text-muted-foreground">
        Arrastra una tarjeta a la siguiente columna para avanzar el pedido.
      </p>

      {loading ? (
        <LoadingState lines={5} />
      ) : error ? (
        <ErrorState onRetry={retry} />
      ) : orders.length === 0 ? (
        <EmptyState
          title="Todavía no tienes pedidos"
          description="Cuando alguien compre tus productos, aparecerán aquí."
          action={
            <Link href="/vendedor/publicar" className={buttonVariants({ size: "sm" })}>
              Publicar producto
            </Link>
          }
        />
      ) : (
        <OrdersKanban
          orders={orders}
          onMove={(orderId, toStatus) => {
            // Las transiciones inválidas las rechaza useSellerOrders ANTES
            // de llamar al service; el error llega acá como excepción.
            move(orderId, toStatus)
              .then(() => toast.success("Pedido actualizado"))
              .catch((err) =>
                toast.error(
                  err instanceof Error ? err.message : "No se pudo actualizar el pedido",
                ),
              );
          }}
        />
      )}
    </div>
  );
}
