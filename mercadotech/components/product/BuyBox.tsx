"use client";

import { Heart } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type BuyBoxProps = {
  stock: number;
  isActive: boolean;
  isOwnProduct: boolean;
  hasSession: boolean;
  isFavorite: boolean;
  onAddToCart: (quantity: number) => void;
  onToggleFavorite: () => void;
  onRequireLogin: () => void;
};

// Puro: no llama a ningún service. "Agregar al carrito" es un callback —
// cart.service/useCart llegan en la Fase 3.6. Los motivos de deshabilitado
// son explícitos: el usuario siempre sabe POR QUÉ no puede comprar.
export function BuyBox({
  stock,
  isActive,
  isOwnProduct,
  hasSession,
  isFavorite,
  onAddToCart,
  onToggleFavorite,
  onRequireLogin,
}: BuyBoxProps) {
  const [quantity, setQuantity] = useState("1");

  // Bloqueos "duros" (deshabilitan el botón): el producto ya no se puede
  // comprar sin importar quién mire. Sin sesión NO es un bloqueo duro — el
  // botón sigue clicable y redirige a login, como preguntar/favorito.
  const isBlocked = !isActive || isOwnProduct || stock <= 0;

  const reasonText = !isActive
    ? "Este producto ya no está disponible"
    : isOwnProduct
      ? "Es tu propio producto"
      : stock <= 0
        ? "Sin stock"
        : !hasSession
          ? "Inicia sesión para comprar"
          : null;

  function handleAddToCart() {
    if (!hasSession) {
      onRequireLogin();
      return;
    }
    onAddToCart(Number(quantity));
  }

  function handleFavoriteClick() {
    if (!hasSession) {
      onRequireLogin();
      return;
    }
    onToggleFavorite();
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      {!isBlocked && (
        <div className="flex items-center gap-2">
          <label htmlFor="buybox-quantity" className="text-sm font-medium">
            Cantidad
          </label>
          <Select value={quantity} onValueChange={(value) => value && setQuantity(value)}>
            <SelectTrigger id="buybox-quantity" className="w-20" data-testid="buybox-quantity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: stock }, (_, i) => i + 1).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {reasonText && (
        <p className="text-sm text-muted-foreground" data-testid="buybox-blocked-reason">
          {reasonText}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={isBlocked}
          onClick={handleAddToCart}
          data-testid="buybox-add-to-cart"
        >
          Agregar al carrito
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleFavoriteClick}
          aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
          aria-pressed={isFavorite}
        >
          <Heart
            className={cn("size-4", isFavorite && "fill-destructive text-destructive")}
            aria-hidden="true"
          />
        </Button>
      </div>
    </div>
  );
}
