import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_PRODUCT,
  TITLE_MAX,
  TITLE_MIN,
} from "@/lib/constants/product";
import type { ProductCondition } from "@/lib/constants/roles";

// Validación framework-agnóstica: sin React, sin Supabase. Devuelve un mapa
// campo → mensaje; vacío = válido (mismo contrato que lib/validators/auth.ts).

export type ProductInput = {
  title: string;
  description: string;
  brand: string;
  categoryId: string;
  condition: ProductCondition;
  price: number | string;
  stock: number | string;
  imageCount: number;
};

export type ValidationErrors = Record<string, string>;

export function validateProduct(input: ProductInput): ValidationErrors {
  const errors: ValidationErrors = {};

  const title = input.title.trim();
  if (title.length < TITLE_MIN) {
    errors.title = `El título debe tener al menos ${TITLE_MIN} caracteres.`;
  } else if (title.length > TITLE_MAX) {
    errors.title = `El título no puede superar los ${TITLE_MAX} caracteres.`;
  }

  if (!input.categoryId) {
    errors.categoryId = "Elige una categoría.";
  }

  const price = Number(input.price);
  if (!Number.isFinite(price) || price <= 0) {
    // Espeja el check de la BD: price numeric(12,2) check (price > 0).
    errors.price = "El precio debe ser mayor que 0.";
  }

  const stock = Number(input.stock);
  if (!Number.isInteger(stock) || stock < 0) {
    // Espeja el check de la BD: stock integer check (stock >= 0).
    errors.stock = "El stock no puede ser negativo.";
  }

  if (input.imageCount < 1) {
    errors.images = "Agrega al menos una imagen.";
  } else if (input.imageCount > MAX_IMAGES_PER_PRODUCT) {
    errors.images = `Máximo ${MAX_IMAGES_PER_PRODUCT} imágenes por producto.`;
  }

  return errors;
}

// Mismos límites que el bucket product-images, verificados antes de subir
// para dar un mensaje claro en vez del 400 genérico de Storage.
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return `"${file.name}": solo se permiten imágenes JPG, PNG o WebP.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `"${file.name}": supera el máximo de 5 MB.`;
  }
  return null;
}

export function isValid(errors: ValidationErrors): boolean {
  return Object.keys(errors).length === 0;
}
