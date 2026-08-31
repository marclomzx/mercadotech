"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ProductForm } from "@/components/seller/ProductForm";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import { useProductForm } from "@/hooks/useProductForm";

type ProductFormViewProps = {
  productId?: string;
};

// Conector compartido por /vendedor/publicar (create) y
// /vendedor/productos/[id]/editar (edit): el MISMO ProductForm y el MISMO
// useProductForm, solo cambia si llega productId.
export function ProductFormView({ productId }: ProductFormViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { categories } = useCategories();
  const form = useProductForm({ sellerId: user?.id ?? null, productId });

  if (form.loading) return <LoadingState lines={8} />;

  // Fallo de red al precargar el producto: se ofrece reintentar en vez de
  // dejar el formulario en blanco.
  if (form.loadError) return <ErrorState onRetry={form.retry} />;

  // Guard de propiedad (ver comentario en useProductForm): un vendedor no
  // puede abrir el formulario de edición de un producto ajeno, aunque la
  // RLS le permita LEERLO por estar activo en el catálogo público.
  if (!form.isOwner) {
    return (
      <EmptyState
        title="Producto no encontrado"
        description="Puede que no exista o que no sea tuyo."
        action={
          <Link href="/vendedor/productos" className={buttonVariants({ size: "sm" })}>
            Ver mis productos
          </Link>
        }
      />
    );
  }

  // Mapea el modelo del hook (local | persisted) al que consume la galería
  // pura: solo key + url, sin saber de dónde salió cada imagen.
  const galleryItems = form.images.map((image) => ({
    key: image.key,
    url: image.kind === "local" ? image.previewUrl : image.imageUrl,
  }));

  async function handleSubmit() {
    try {
      const savedId = await form.submit();
      if (!savedId) return; // validación falló; los errores ya están en el form
      toast.success(form.mode === "create" ? "Producto publicado" : "Cambios guardados");
      router.push("/vendedor/productos");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el producto");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        {form.mode === "create" ? "Publicar producto" : "Editar producto"}
      </h1>

      <ProductForm
        values={form.values}
        errors={form.errors}
        categories={categories}
        images={galleryItems}
        submitting={form.submitting}
        submitLabel={form.mode === "create" ? "Publicar" : "Guardar cambios"}
        onChange={form.setValue}
        onReorderImages={(keys) => {
          // La galería devuelve solo el orden de keys; se reconstruye el
          // array de imágenes completo en ese orden.
          const byKey = new Map(form.images.map((image) => [image.key, image]));
          const reordered = keys
            .map((key) => byKey.get(key))
            .filter((image): image is NonNullable<typeof image> => Boolean(image));
          form.reorder(reordered).catch(() => toast.error("No se pudo guardar el orden"));
        }}
        onAddFiles={(files) => {
          form.addFiles(files).catch(() => toast.error("No se pudieron subir las imágenes"));
        }}
        onRemoveImage={(key) => {
          form.removeImage(key).catch(() => toast.error("No se pudo quitar la imagen"));
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
