"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { CartItemRow } from "@/components/cart/CartItemRow";
import { CartSummary } from "@/components/cart/CartSummary";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";

// Devuelve el mensaje del error tal cual lo mandó Postgres: el RPC ya
// nombra el producto que falló ("Stock insuficiente para X: disponible 0,
// solicitado 1"), así que reescribirlo solo perdería información útil.
function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "No se pudo completar la compra.";
}

export function CartView() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, subtotal, count, loading, error, update, remove, checkout, reload } = useCart(
    user?.id ?? null,
  );
  const [checkingOut, setCheckingOut] = useState(false);

  async function handleCheckout() {
    setCheckingOut(true);
    try {
      const orderId = await checkout();
      toast.success("Pedido creado");
      router.push(`/pedidos/${orderId}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
      // useCart.checkout ya recargó el carrito en su finally (el stock pudo
      // haber cambiado); esto es solo por si el fallo vino antes del RPC.
      await reload();
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading) return <LoadingState lines={5} />;
  if (error) return <ErrorState onRetry={reload} />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Tu carrito</h1>

      {items.length === 0 ? (
        <EmptyState
          title="Tu carrito está vacío"
          description="Agrega productos para verlos aquí."
          action={<Button onClick={() => router.push("/")}>Explorar productos</Button>}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <div>
            {items.map((item) => (
              <CartItemRow
                key={item.id}
                id={item.id}
                quantity={item.quantity}
                product={item.product}
                onQuantityChange={(itemId, quantity) => {
                  update(itemId, quantity).catch(() =>
                    toast.error("No se pudo actualizar la cantidad"),
                  );
                }}
                onRemove={(itemId) => {
                  remove(itemId).catch(() => toast.error("No se pudo quitar el producto"));
                }}
              />
            ))}
          </div>
          <CartSummary
            subtotal={subtotal}
            itemCount={count}
            checkingOut={checkingOut}
            onCheckout={handleCheckout}
          />
        </div>
      )}
    </div>
  );
}
