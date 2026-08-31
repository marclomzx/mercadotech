"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import * as productService from "@/services/product.service";
import type { Product, ProductImage } from "@/types/product";

export function useProduct(productId: string) {
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<(ProductImage & { image_url: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProduct = useCallback(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      productService.getProductById(productId),
      productService.getProductImages(productId),
    ])
      .then(([productData, imagesData]) => {
        setProduct(productData);
        setImages(imagesData);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "No se pudo cargar el producto.");
      })
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  useEffect(() => {
    if (!user) return;
    // product_views_insert_own exige sesión (decisión 14). Fire-and-forget:
    // una vista que falla no debe romper la pantalla de producto ni mostrar
    // error al usuario.
    productService.registerView(productId, user.id).catch(() => {});
  }, [productId, user]);

  return { product, images, loading, error, retry: fetchProduct };
}
