"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { ProductGrid } from "@/components/catalog/ProductGrid";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSemanticSearch } from "@/hooks/useSemanticSearch";

// Conector de la pestaña "Resultados con IA" — vive en app/(shop)/buscar/ y
// no en components/ (regla de capas: components/ no importa hooks/). Es
// exclusivo de esta pestaña: la pestaña "Coincidencia exacta" sigue siendo
// CatalogView tal cual, sin tocar.
//
// Lee el mismo `q` de la URL que la pestaña exacta (useProducts lo lee
// igual) — las dos pestañas comparten una sola fuente de verdad para la
// consulta, solo cambia cómo la interpretan.
export function SemanticSearchResults() {
  const { user, initializing } = useAuth();
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";

  const { results, loading, error, searched, search, reset } = useSemanticSearch();

  useEffect(() => {
    if (!user || !query) {
      reset();
      return;
    }
    search(query);
    // search/reset son estables (useCallback con deps []); solo importa
    // reaccionar a cambios reales de sesión o de consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, query]);

  // Mientras useAuth resuelve la sesión inicial, no se puede decidir todavía
  // si mostrar resultados o el aviso de login — mismo criterio que el resto
  // del proyecto (ej. SellerGuard) para no parpadear.
  if (initializing) return <LoadingState lines={4} />;

  if (!user) {
    return (
      <EmptyState
        title="Inicia sesión para usar la búsqueda inteligente"
        description="Con tu cuenta, MercadoTech entiende lo que necesitas aunque no uses las palabras exactas del producto."
        action={
          <Link
            href={`/login?redirectTo=${encodeURIComponent(
              query ? `/buscar?q=${query}` : "/buscar",
            )}`}
            className={buttonVariants({ size: "sm" })}
          >
            Iniciar sesión
          </Link>
        }
      />
    );
  }

  if (!query) {
    return (
      <EmptyState
        title="Escribe qué buscas"
        description="Describe lo que necesitas con tus propias palabras, arriba en el buscador."
      />
    );
  }

  if (error) {
    return <ErrorState description={error} onRetry={() => search(query)} />;
  }

  if (!loading && searched && results.length === 0) {
    return (
      <EmptyState
        title="No encontramos coincidencias"
        description="Prueba describir para qué lo necesitas, con otras palabras."
      />
    );
  }

  // Product → similitud, para el badge opcional de ProductCard (extensión
  // por props, no un card distinto para esta pestaña).
  const similarities = Object.fromEntries(
    results.map((result) => [result.product.id, result.similarity]),
  );

  return (
    <ProductGrid
      products={results.map((result) => result.product)}
      loading={loading}
      similarities={similarities}
    />
  );
}
