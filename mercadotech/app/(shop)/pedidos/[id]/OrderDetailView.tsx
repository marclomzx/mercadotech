"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { OrderItemsTable } from "@/components/orders/OrderItemsTable";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Price } from "@/components/shared/Price";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useOrder } from "@/hooks/useOrders";

type OrderDetailViewProps = {
  orderId: string;
};

export function OrderDetailView({ orderId }: OrderDetailViewProps) {
  const { order, items, loading, error, cancel, retry } = useOrder(orderId);
  const [cancelling, setCancelling] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (loading) return <LoadingState lines={6} />;
  if (error) return <ErrorState onRetry={retry} />;
  if (!order) {
    // Cubre dos casos indistinguibles a propósito: el pedido no existe, o
    // es de otro comprador y la RLS no deja verlo. No se filtra cuál es.
    return (
      <EmptyState
        title="Pedido no encontrado"
        description="Puede que no exista o que no tengas acceso a él."
        action={
          <Link href="/pedidos" className={buttonVariants({ size: "sm" })}>
            Ver mis pedidos
          </Link>
        }
      />
    );
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancel();
      toast.success("Pedido cancelado");
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cancelar el pedido");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-mono text-lg font-semibold">#{order.id.slice(0, 8)}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(order.created_at).toLocaleDateString("es-PE")}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <OrderItemsTable items={items} />

      <div className="flex items-center justify-between border-t pt-4">
        <span className="font-medium">Total</span>
        <Price value={order.total} size="lg" />
      </div>

      {/* El botón solo existe si el pedido está 'pendiente' — misma
          condición que exige orders_update_buyer_cancel_pending. Si se
          forzara igual, la RLS lo rechazaría. */}
      {order.status === "pendiente" && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button variant="destructive" />}>Cancelar pedido</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Cancelar este pedido?</DialogTitle>
              <DialogDescription>
                Esta acción no se puede deshacer. El stock no se repone automáticamente.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? "Cancelando..." : "Sí, cancelar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
