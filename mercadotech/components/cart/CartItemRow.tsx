"use client";

import { Trash2 } from "lucide-react";

import { Price } from "@/components/shared/Price";
import { ProductImage } from "@/components/shared/ProductImage";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Product } from "@/types/product";

type CartItemRowProps = {
  id: string;
  quantity: number;
  product: Product | null;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
};

export function CartItemRow({
  id,
  quantity,
  product,
  onQuantityChange,
  onRemove,
}: CartItemRowProps) {
  // product null = el vendedor lo desactivó y la RLS ya no deja verlo. No se
  // puede comprar ni cambiar cantidad; solo quitarlo del carrito.
  if (!product) {
    return (
      <div className="flex items-center justify-between gap-4 border-b py-4">
        <div className="flex items-center gap-3">
          <ProductImage src={null} alt="Producto no disponible" className="size-16 rounded-md" />
          <p className="text-sm text-muted-foreground">
            Este producto ya no está disponible
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onRemove(id)} aria-label="Quitar del carrito">
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b py-4">
      <div className="flex min-w-0 items-center gap-3">
        <ProductImage
          src={product.image_url}
          alt={product.title}
          className="size-16 shrink-0 rounded-md"
        />
        <div className="min-w-0 space-y-1">
          <p className="line-clamp-2 text-sm font-medium">{product.title}</p>
          <Price value={product.price} size="sm" />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Select
          value={String(quantity)}
          onValueChange={(value) => value && onQuantityChange(id, Number(value))}
        >
          <SelectTrigger className="w-20" aria-label="Cantidad">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* Acotado al stock actual: no se ofrece más de lo que hay. */}
            {Array.from({ length: Math.max(product.stock, quantity) }, (_, i) => i + 1).map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" onClick={() => onRemove(id)} aria-label="Quitar del carrito">
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
