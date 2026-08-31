"use client";

import { useCallback, useEffect, useState } from "react";

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
  }, []);

  // Propaga el error tal cual (incluido PRODUCT_HAS_SALES_MESSAGE) para que
  // la página lo muestre en un toast sin reescribirlo.
  const remove = useCallback(async (productId: string) => {
    await sellerService.deleteProduct(productId);
    setProducts((prev) => prev.filter((product) => product.id !== productId));
  }, []);

  return { products, loading, error, toggleActive, remove, retry: fetchProducts };
}
