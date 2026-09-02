import Link from "next/link";

import { ConditionBadge } from "@/components/shared/ConditionBadge";
import { Price } from "@/components/shared/Price";
import { ProductImage } from "@/components/shared/ProductImage";
import { RatingStars } from "@/components/shared/RatingStars";
import type { Product } from "@/types/product";

type ProductCardProps = {
  product: Product;
  // Opcional: solo lo pasa la pestaña "Resultados con IA" (Fase 4.4). Un
  // 0–1 de qué tan bien coincide el producto con la búsqueda. Extiende el
  // card por prop en vez de duplicarlo — el resto de usos (catálogo,
  // favoritos, panel del vendedor) no lo pasan y no ven ningún cambio.
  similarity?: number;
};

// Puro: recibe el Product ya resuelto (price:number, image_url, rating).
// No conoce Supabase — el service ya hizo todo el trabajo de mapeo.
export function ProductCard({ product, similarity }: ProductCardProps) {
  return (
    <Link
      href={`/producto/${product.id}`}
      className="group flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:border-primary"
      data-testid="product-card"
    >
      <div className="relative">
        <ProductImage
          src={product.image_url}
          alt={product.title}
          className="aspect-square w-full rounded-md"
        />
        {similarity !== undefined && (
          // Nada de "similitud" ni porcentajes crudos de cara al usuario:
          // se traduce a una etiqueta simple de qué tan buena es la
          // coincidencia, sin jerga de embeddings/vectores.
          <span className="absolute top-1.5 right-1.5 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium text-muted-foreground shadow-sm">
            {similarity >= 0.5 ? "Coincidencia alta" : "Coincidencia media"}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <ConditionBadge condition={product.condition} />
        <h3 className="line-clamp-2 text-sm font-medium" data-testid="product-card-title">
          {product.title}
        </h3>
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
