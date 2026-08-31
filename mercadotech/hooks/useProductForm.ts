"use client";

import { useCallback, useEffect, useState } from "react";

import type { ProductCondition } from "@/lib/constants/roles";
import {
  isValid,
  validateImageFile,
  validateProduct,
  type ValidationErrors,
} from "@/lib/validators/product";
import * as productService from "@/services/product.service";
import * as sellerService from "@/services/seller.service";
import * as storageService from "@/services/storage.service";

export type ProductFormValues = {
  title: string;
  description: string;
  brand: string;
  categoryId: string;
  condition: ProductCondition;
  price: string;
  stock: string;
};

// Una imagen puede estar en dos estados según el modo:
// - local: solo existe en memoria (File + preview blob). Modo create, o
//   recién elegida en edit antes de subirse.
// - persisted: ya vive en Storage y en product_images (tiene id y path).
export type GalleryImage =
  | { kind: "local"; key: string; file: File; previewUrl: string }
  | { kind: "persisted"; key: string; id: string; imagePath: string; imageUrl: string };

const EMPTY_VALUES: ProductFormValues = {
  title: "",
  description: "",
  brand: "",
  categoryId: "",
  condition: "nuevo",
  price: "",
  stock: "0",
};

type UseProductFormOptions = {
  sellerId: string | null;
  productId?: string;
};

export function useProductForm({ sellerId, productId }: UseProductFormOptions) {
  const mode = productId ? "edit" : "create";

  const [values, setValues] = useState<ProductFormValues>(EMPTY_VALUES);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);
  // seller_id del producto cargado. Necesario para el guard de propiedad:
  // la política products_select_active_or_own deja LEER cualquier producto
  // activo (es el catálogo público), así que sin esta comprobación un
  // vendedor podría abrir el formulario de edición de otro. El UPDATE sí lo
  // bloquearía la RLS, pero recién al guardar — mejor no mostrar el form.
  const [loadedSellerId, setLoadedSellerId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Fuerza recargar tras un fallo (el botón "Reintentar" del ErrorState).
  const [reloadToken, setReloadToken] = useState(0);

  // En modo edit, precarga producto e imágenes ya persistidas.
  useEffect(() => {
    if (!productId) return;
    let active = true;
    setLoading(true);
    setLoadError(null);

    Promise.all([
      productService.getProductById(productId),
      productService.getProductImages(productId),
    ])
      .then(([product, productImages]) => {
        if (!active || !product) return;
        setLoadedSellerId(product.seller_id);
        setValues({
          title: product.title,
          description: product.description ?? "",
          brand: product.brand ?? "",
          categoryId: product.category_id,
          condition: product.condition,
          price: String(product.price),
          stock: String(product.stock),
        });
        setImages(
          productImages.map((image) => ({
            kind: "persisted" as const,
            key: image.id,
            id: image.id,
            imagePath: image.image_path,
            imageUrl: image.image_url,
          })),
        );
      })
      .catch((err) => {
        // Sin este catch, un fallo de red dejaba una promesa rechazada sin
        // manejar y el formulario en blanco, sin explicación ni reintento.
        if (!active) return;
        setLoadError(
          err instanceof Error ? err.message : "No se pudo cargar el producto.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [productId, reloadToken]);

  // Libera los blobs de preview al desmontar (los File locales no se
  // recolectan solos mientras exista la URL).
  useEffect(() => {
    return () => {
      images.forEach((image) => {
        if (image.kind === "local") URL.revokeObjectURL(image.previewUrl);
      });
    };
    // Solo al desmontar: incluir `images` haría revoke en cada cambio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setValue = useCallback(<K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  // El siguiente `n` para el path de Storage: max(n actual) + 1. Se deriva
  // del nombre del archivo ya subido ({n}.{ext}) para no reutilizar un
  // número y sobrescribir una imagen existente.
  const nextImageNumber = useCallback(() => {
    const numbers = images
      .filter((image): image is Extract<GalleryImage, { kind: "persisted" }> =>
        image.kind === "persisted",
      )
      .map((image) => Number(image.imagePath.split("/").pop()?.split(".")[0] ?? 0));
    return numbers.length ? Math.max(...numbers) + 1 : 1;
  }, [images]);

  const addFiles = useCallback(
    async (files: File[]) => {
      const rejected = files.map(validateImageFile).filter(Boolean) as string[];
      if (rejected.length > 0) {
        setErrors((prev) => ({ ...prev, images: rejected[0] }));
        return;
      }
      setErrors((prev) => {
        const next = { ...prev };
        delete next.images;
        return next;
      });

      // Modo create: quedan solo en memoria — todavía no existe product_id,
      // que el path de Storage exige (decisión 12).
      if (mode === "create" || !productId || !sellerId) {
        setImages((prev) => [
          ...prev,
          ...files.map((file) => ({
            kind: "local" as const,
            key: `${file.name}-${crypto.randomUUID()}`,
            file,
            previewUrl: URL.createObjectURL(file),
          })),
        ]);
        return;
      }

      // Modo edit: se suben AL INSTANTE con n = max(n) + 1.
      let n = nextImageNumber();
      let position = images.length;
      for (const file of files) {
        const path = await storageService.uploadProductImage(file, sellerId, productId, n);
        const row = await storageService.addProductImage(productId, path, position);

        setImages((prev) => [
          ...prev,
          {
            kind: "persisted",
            key: row.id,
            id: row.id,
            imagePath: path,
            imageUrl: storageService.getPublicUrl(storageService.PRODUCT_IMAGES_BUCKET, path),
          },
        ]);
        n += 1;
        position += 1;
      }
    },
    [mode, productId, sellerId, images.length, nextImageNumber],
  );

  const removeImage = useCallback(async (key: string) => {
    const target = images.find((image) => image.key === key);
    if (!target) return;

    if (target.kind === "local") {
      URL.revokeObjectURL(target.previewUrl);
      setImages((prev) => prev.filter((image) => image.key !== key));
      return;
    }

    // Persistida: borra en Storage y en la tabla.
    await storageService.deleteProductImage(target.id, target.imagePath);
    setImages((prev) => prev.filter((image) => image.key !== key));
  }, [images]);

  // Reordenar: en create es puramente local; en edit persiste de inmediato.
  const reorder = useCallback(
    async (nextImages: GalleryImage[]) => {
      setImages(nextImages);

      if (mode !== "edit" || !productId) return;

      const persisted = nextImages.filter(
        (image): image is Extract<GalleryImage, { kind: "persisted" }> =>
          image.kind === "persisted",
      );
      // Filas COMPLETAS: image_path y product_id son NOT NULL, un upsert
      // parcial los mandaría null.
      await storageService.saveImageOrder(
        persisted.map((image, index) => ({
          id: image.id,
          product_id: productId,
          image_path: image.imagePath,
          position: index,
        })),
      );
    },
    [mode, productId],
  );

  const submit = useCallback(async (): Promise<string | null> => {
    const validation = validateProduct({ ...values, imageCount: images.length });
    setErrors(validation);
    if (!isValid(validation) || !sellerId) return null;

    setSubmitting(true);
    try {
      const payload = {
        title: values.title.trim(),
        description: values.description.trim() || null,
        brand: values.brand.trim() || null,
        categoryId: values.categoryId,
        condition: values.condition,
        price: Number(values.price),
        stock: Number(values.stock),
      };

      if (mode === "edit" && productId) {
        await sellerService.updateProduct(productId, payload);
        return productId;
      }

      // Modo create, en el orden que exige la decisión 12:
      // 1) crear el producto (recién ahí hay product_id para el path)
      const product = await sellerService.createProduct(sellerId, payload);

      // 2) subir en el ORDEN ACTUAL del array y 3) insertar product_images
      //    con position = índice (la primera es la portada).
      for (const [index, image] of images.entries()) {
        if (image.kind !== "local") continue;
        const path = await storageService.uploadProductImage(
          image.file,
          sellerId,
          product.id,
          index + 1,
        );
        await storageService.addProductImage(product.id, path, index);
      }

      return product.id;
    } finally {
      setSubmitting(false);
    }
  }, [values, images, sellerId, mode, productId]);

  // Solo tiene sentido en modo edit; en create el producto todavía no existe
  // y siempre es "propio" por construcción.
  const isOwner = mode === "create" || (loadedSellerId !== null && loadedSellerId === sellerId);

  return {
    mode,
    values,
    images,
    errors,
    loading,
    loadError,
    submitting,
    isOwner,
    setValue,
    addFiles,
    removeImage,
    reorder,
    submit,
    retry: () => setReloadToken((token) => token + 1),
  };
}
