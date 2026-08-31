import { Price } from "@/components/shared/Price";
import { Button } from "@/components/ui/button";

type CartSummaryProps = {
  subtotal: number;
  itemCount: number;
  checkingOut: boolean;
  onCheckout: () => void;
};

export function CartSummary({ subtotal, itemCount, checkingOut, onCheckout }: CartSummaryProps) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Subtotal ({itemCount} {itemCount === 1 ? "producto" : "productos"})
        </span>
        <Price value={subtotal} size="lg" />
      </div>

      {/* Requisito explícito de la spec: el usuario debe saber que no hay
          cobro real. No se pide ni se almacena ningún dato de pago. */}
      <p className="text-xs text-muted-foreground">
        Pago simulado para el laboratorio — no se realiza ningún cobro.
      </p>

      <Button className="w-full" onClick={onCheckout} disabled={checkingOut || itemCount === 0}>
        {checkingOut ? "Procesando..." : "Finalizar compra"}
      </Button>
    </div>
  );
}
