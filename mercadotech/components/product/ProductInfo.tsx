import { ConditionBadge } from "@/components/shared/ConditionBadge";
import { Price } from "@/components/shared/Price";
import type { Product } from "@/types/product";

type ProductInfoProps = {
  product: Product;
};

export function ProductInfo({ product }: ProductInfoProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ConditionBadge condition={product.condition} />
        {product.brand && <span className="text-sm text-muted-foreground">{product.brand}</span>}
      </div>
      <h1 className="text-xl font-semibold" data-testid="product-title">
        {product.title}
      </h1>
      <Price value={product.price} size="lg" data-testid="product-price" />
      {product.description && (
        <p className="whitespace-pre-line text-sm text-muted-foreground">{product.description}</p>
      )}
      <p className="text-sm text-muted-foreground">
        {product.stock > 0 ? `${product.stock} disponibles` : "Sin stock"}
      </p>
    </div>
  );
}
