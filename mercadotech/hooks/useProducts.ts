"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { DEFAULT_SORT, type SortOption } from "@/lib/constants/catalog";
import type { ProductCondition } from "@/lib/constants/roles";
import * as productService from "@/services/product.service";
import type { Product } from "@/types/product";

type UseProductsOptions = {
  categorySlug?: string;
};

// Lee los filtros de useSearchParams (única fuente de verdad): cambiar un
// filtro escribe la URL, así que el estado es compartible/recargable y
// nunca se desincroniza entre la URL y lo que ve el usuario.
export function useProducts({ categorySlug }: UseProductsOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const search = searchParams.get("q") ?? undefined;
  const sort = (searchParams.get("sort") as SortOption | null) ?? DEFAULT_SORT;
  const conditionParam = searchParams.get("condition") ?? "";
  const condition = conditionParam
    ? (conditionParam.split(",").filter(Boolean) as ProductCondition[])
    : undefined;
  const minPriceParam = searchParams.get("minPrice");
  const maxPriceParam = searchParams.get("maxPrice");
  const minPrice = minPriceParam ? Number(minPriceParam) : undefined;
  const maxPrice = maxPriceParam ? Number(maxPriceParam) : undefined;

  const fetchProducts = useCallback(() => {
    setLoading(true);
    setError(null);
    productService
      .listActiveProducts({ categorySlug, search, sort, condition, minPrice, maxPrice, page })
      .then((result) => {
        setItems(result.items);
        setTotal(result.total);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "No se pudieron cargar los productos.",
        );
      })
      .finally(() => setLoading(false));
    // conditionParam/minPriceParam/maxPriceParam (strings) en vez de
    // condition/minPrice/maxPrice (arrays/numbers derivados): esos se
    // recrean en cada render y romperían la memoización.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySlug, search, sort, conditionParam, minPriceParam, maxPriceParam, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const setFilter = useCallback(
    (key: string, value: string | string[] | null) => {
      const params = new URLSearchParams(searchParams.toString());
      const flat = Array.isArray(value) ? value.join(",") : value;

      if (!flat) {
        params.delete(key);
      } else {
        params.set(key, flat);
      }
      // Cualquier cambio de filtro vuelve a la página 1: la página anterior
      // podría ni siquiera existir con el nuevo resultado.
      params.delete("page");

      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(nextPage));
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  return { items, total, page, loading, error, setFilter, setPage, retry: fetchProducts };
}
