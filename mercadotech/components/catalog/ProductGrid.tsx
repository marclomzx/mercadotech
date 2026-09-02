import type { ReactNode } from "react";

import { ProductCard } from "@/components/catalog/ProductCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/types/product";

type ProductGridProps = {
  products: Product[];
  loading: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  // Opcional: id de producto → similitud (0–1). Solo lo usa la pestaña
  // "Resultados con IA" para el badge de coincidencia — el resto de usos no
  // lo pasa y ProductCard se renderiza exactamente igual que siempre.
  similarities?: Record<string, number>;
};

// Suficientes para llenar 3 filas en desktop (4 columnas) sin que el
// skeleton se vea corto ni sobre demasiado en pantallas chicas.
const SKELETON_COUNT = 8;

const GRID_CLASSES = "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4";

function ProductCardSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="aspect-square w-full rounded-md" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function ProductGrid({
  products,
  loading,
  emptyTitle = "No encontramos productos",
  emptyDescription = "Prueba ajustando los filtros o la búsqueda.",
  emptyAction,
  similarities,
}: ProductGridProps) {
  if (loading) {
    return (
      <div className={GRID_CLASSES}>
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <div className={GRID_CLASSES}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} similarity={similarities?.[product.id]} />
      ))}
    </div>
  );
}
