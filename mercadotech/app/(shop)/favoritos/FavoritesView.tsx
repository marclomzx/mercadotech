"use client";

import { useRouter } from "next/navigation";

import { ProductGrid } from "@/components/catalog/ProductGrid";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";

// Conector hook ↔ componentes puros. /favoritos ya está en la lista de
// rutas protegidas del middleware (Fase 3.3), así que un anónimo nunca
// llega hasta acá.
export function FavoritesView() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, loading, error, retry } = useFavorites(user?.id ?? null);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Mis favoritos</h1>
      {error ? (
        <ErrorState onRetry={retry} />
      ) : (
        <ProductGrid
          products={items}
          loading={loading}
          emptyTitle="Aún no tienes favoritos"
          emptyDescription="Guarda productos que te interesen para verlos aquí."
          emptyAction={
            !loading ? <Button onClick={() => router.push("/")}>Explorar productos</Button> : undefined
          }
        />
      )}
    </div>
  );
}
