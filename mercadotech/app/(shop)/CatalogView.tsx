"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FiltersPanel, type FiltersValue } from "@/components/catalog/FiltersPanel";
import { Pagination } from "@/components/catalog/Pagination";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { DEFAULT_SORT, PRODUCTS_PAGE_SIZE, type SortOption } from "@/lib/constants/catalog";
import type { ProductCondition } from "@/lib/constants/roles";
import { useProducts } from "@/hooks/useProducts";

type CatalogViewProps = {
  title: string;
  categorySlug?: string;
};

// Conector hook ↔ componentes puros — vive en app/, no en components/catalog/,
// porque usa useProducts (regla de capas: components/ no importa hooks/).
// La reutilizan las 3 páginas del catálogo (home, categoría, búsqueda) con
// el MISMO grid y el MISMO hook, solo cambia el título y el categorySlug.
export function CatalogView({ title, categorySlug }: CatalogViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { items, total, page, loading, error, setFilter, setPage, retry } = useProducts({
    categorySlug,
  });

  // Vuelve a la ruta sin query: limpia filtros, búsqueda y paginación de
  // una sola vez (la URL es la única fuente de verdad de los filtros).
  function clearFilters() {
    router.push(pathname);
  }

  const filtersValue: FiltersValue = {
    condition: (searchParams.get("condition")?.split(",").filter(Boolean) ??
      []) as ProductCondition[],
    minPrice: searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined,
    maxPrice: searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined,
    sort: (searchParams.get("sort") as SortOption | null) ?? DEFAULT_SORT,
  };

  function handleFiltersChange(patch: Partial<FiltersValue>) {
    if (patch.condition !== undefined) setFilter("condition", patch.condition);
    if ("minPrice" in patch) {
      setFilter("minPrice", patch.minPrice !== undefined ? String(patch.minPrice) : null);
    }
    if ("maxPrice" in patch) {
      setFilter("maxPrice", patch.maxPrice !== undefined ? String(patch.maxPrice) : null);
    }
    if (patch.sort !== undefined) setFilter("sort", patch.sort);
  }

  const totalPages = Math.max(1, Math.ceil(total / PRODUCTS_PAGE_SIZE));

  // Hay filtros activos si la URL trae algo más que la paginación: en ese
  // caso la lista vacía se debe a los filtros y la acción útil es limpiarlos.
  const hasActiveFilters = ["condition", "minPrice", "maxPrice", "sort", "q"].some((key) =>
    searchParams.has(key),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{title}</h1>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <FiltersPanel value={filtersValue} onChange={handleFiltersChange} />

        <div className="space-y-4">
          {error ? (
            <ErrorState onRetry={retry} />
          ) : (
            <>
              <ProductGrid
                products={items}
                loading={loading}
                emptyDescription={
                  hasActiveFilters
                    ? "Prueba ajustando los filtros o la búsqueda."
                    : "Todavía no hay productos publicados."
                }
                emptyAction={
                  hasActiveFilters ? (
                    <Button variant="outline" onClick={clearFilters}>
                      Limpiar filtros
                    </Button>
                  ) : undefined
                }
              />
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
