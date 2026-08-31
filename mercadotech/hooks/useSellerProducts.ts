"use client";

import { useCallback, useEffect, useState } from "react";

import { triggerReindex } from "@/services/indexing-trigger.service";
import * as sellerService from "@/services/seller.service";
import type { Product } from "@/types/product";

export function useSellerProducts(sellerId: string | null) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(() => {
    if (!sellerId) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    sellerService
      .listMyProducts(sellerId)
      .then(setProducts)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "No se pudieron cargar tus productos.");
      })
      .finally(() => setLoading(false));
  }, [sellerId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const toggleActive = useCallback(async (productId: string, isActive: boolean) => {
    await sellerService.toggleActive(productId, isActive);
    setProducts((prev) =>
      prev.map((product) =>
        product.id === productId ? { ...product, is_active: isActive } : product,
      ),
    );
    // Un mismo disparo resuelve los dos sentidos: indexSource ficha el
    // producto si quedó activo, y BORRA su ficha si quedó pausado. Un
    // producto despublicado no debe seguir apareciendo en la búsqueda
    // semántica.
    triggerReindex("producto", productId);
  }, []);

  // Propaga el error tal cual (incluido PRODUCT_HAS_SALES_MESSAGE) para que
  // la página lo muestre en un toast sin reescribirlo.
  const remove = useCallback(async (productId: string) => {
    await sellerService.deleteProduct(productId);
    setProducts((prev) => prev.filter((product) => product.id !== productId));
    // El producto ya no existe: indexSource no lo encontrará y limpiará su
    // ficha huérfana (decisión 6 — source_id no tiene foreign key, así que
    // la base no la borra sola).
    triggerReindex("producto", productId);
  }, []);

  return { products, loading, error, toggleActive, remove, retry: fetchProducts };
}
