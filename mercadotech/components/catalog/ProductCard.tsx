import Link from "next/link";

import { ConditionBadge } from "@/components/shared/ConditionBadge";
import { Price } from "@/components/shared/Price";
import { ProductImage } from "@/components/shared/ProductImage";
import { RatingStars } from "@/components/shared/RatingStars";
import type { Product } from "@/types/product";

type ProductCardProps = {
  product: Product;
};

// Puro: recibe el Product ya resuelto (price:number, image_url, rating).
// No conoce Supabase — el service ya hizo todo el trabajo de mapeo.
export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      href={`/producto/${product.id}`}
      className="group flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:border-primary"
    >
      <ProductImage
        src={product.image_url}
        alt={product.title}
        className="aspect-square w-full rounded-md"
      />
      <div className="space-y-1">
        <ConditionBadge condition={product.condition} />
        <h3 className="line-clamp-2 text-sm font-medium">{product.title}</h3>
        <Price value={product.price} />
        {product.review_count > 0 && (
          <div className="flex items-center gap-1.5">
            <RatingStars value={product.average_rating ?? 0} size="sm" />
            <span className="text-xs text-muted-foreground">({product.review_count})</span>
          </div>
        )}
      </div>
    </Link>
  );
}
