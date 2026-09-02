"use client";

import dynamic from "next/dynamic";
import type { FormEvent } from "react";

import { LoadingState } from "@/components/shared/LoadingState";
import type { GalleryItem } from "@/components/seller/SortableImageGallery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCT_CONDITIONS, type ProductCondition } from "@/lib/constants/roles";
import type { Database } from "@/types/database";

type Category = Database["public"]["Tables"]["categories"]["Row"];

// La galería arrastra @dnd-kit/{core,sortable,utilities} y era la única razón
// de que /vendedor/publicar y /vendedor/productos/[id]/editar fueran las dos
// rutas más pesadas del proyecto (277 kB First Load JS). Se carga aparte:
// nadie necesita el código de drag & drop hasta que el formulario está en
// pantalla. ssr:false porque dnd-kit necesita DOM real de todos modos.
const SortableImageGallery = dynamic(
  () => import("@/components/seller/SortableImageGallery").then((m) => m.SortableImageGallery),
  { ssr: false, loading: () => <LoadingState lines={2} /> },
);

export type ProductFormValues = {
  title: string;
  description: string;
  brand: string;
  categoryId: string;
  condition: ProductCondition;
  price: string;
  stock: string;
};

type ProductFormProps = {
  values: ProductFormValues;
  errors: Record<string, string>;
  categories: Category[];
  images: GalleryItem[];
  submitting: boolean;
  submitLabel: string;
  onChange: <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => void;
  onReorderImages: (keys: string[]) => void;
  onAddFiles: (files: File[]) => void;
  onRemoveImage: (key: string) => void;
  onSubmit: () => void;
};

const CONDITION_LABELS: Record<ProductCondition, string> = {
  nuevo: "Nuevo",
  usado: "Usado",
  reacondicionado: "Reacondicionado",
};

// Puro: value + errors + callbacks. Toda la lógica (validar, subir, ordenar)
// vive en useProductForm.
export function ProductForm({
  values,
  errors,
  categories,
  images,
  submitting,
  submitLabel,
  onChange,
  onReorderImages,
  onAddFiles,
  onRemoveImage,
  onSubmit,
}: ProductFormProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          value={values.title}
          onChange={(event) => onChange("title", event.target.value)}
          aria-invalid={Boolean(errors.title)}
        />
        {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          value={values.description}
          onChange={(event) => onChange("description", event.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="brand">Marca</Label>
          <Input
            id="brand"
            value={values.brand}
            onChange={(event) => onChange("brand", event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category">Categoría</Label>
          <Select
            value={values.categoryId}
            onValueChange={(value) => value && onChange("categoryId", value)}
          >
            <SelectTrigger id="category" className="w-full" aria-invalid={Boolean(errors.categoryId)}>
              <SelectValue placeholder="Elige una categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="condition">Condición</Label>
          <Select
            value={values.condition}
            onValueChange={(value) => value && onChange("condition", value as ProductCondition)}
          >
            <SelectTrigger id="condition" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_CONDITIONS.map((condition) => (
                <SelectItem key={condition} value={condition}>
                  {CONDITION_LABELS[condition]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="price">Precio (S/)</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            min="0"
            value={values.price}
            onChange={(event) => onChange("price", event.target.value)}
            aria-invalid={Boolean(errors.price)}
          />
          {errors.price && <p className="text-sm text-destructive">{errors.price}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="stock">Stock</Label>
          <Input
            id="stock"
            type="number"
            min="0"
            value={values.stock}
            onChange={(event) => onChange("stock", event.target.value)}
            aria-invalid={Boolean(errors.stock)}
          />
          {errors.stock && <p className="text-sm text-destructive">{errors.stock}</p>}
        </div>
      </div>

      <SortableImageGallery
        items={images}
        error={errors.images}
        onReorder={onReorderImages}
        onAddFiles={onAddFiles}
        onRemove={onRemoveImage}
      />

      <Button type="submit" disabled={submitting}>
        {submitting ? "Guardando..." : submitLabel}
      </Button>
    </form>
  );
}
