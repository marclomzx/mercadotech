"use client";

import Link from "next/link";
import { toast } from "sonner";

import { ProductsTable } from "@/components/seller/ProductsTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSellerProducts } from "@/hooks/useSellerProducts";

export function SellerProductsView() {
  const { user } = useAuth();
  const { products, loading, error, toggleActive, remove, retry } = useSellerProducts(
    user?.id ?? null,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Mis productos</h1>
        <Link href="/vendedor/publicar" className={buttonVariants({ size: "sm" })}>
          Publicar producto
        </Link>
      </div>

      {loading ? (
        <LoadingState lines={5} />
      ) : error ? (
        <ErrorState onRetry={retry} />
      ) : products.length === 0 ? (
        <EmptyState
          title="Todavía no publicaste nada"
          description="Publica tu primer producto para empezar a vender."
          action={
            <Link href="/vendedor/publicar" className={buttonVariants({ size: "sm" })}>
              Publicar producto
            </Link>
          }
        />
      ) : (
        <ProductsTable
          products={products}
          onToggleActive={(productId, isActive) => {
            toggleActive(productId, isActive)
              .then(() => toast.success(isActive ? "Producto activado" : "Producto desactivado"))
              .catch(() => toast.error("No se pudo cambiar el estado"));
          }}
          onDelete={(productId) => {
            // El mensaje de "tiene ventas" viaja tal cual desde el service
            // (PRODUCT_HAS_SALES_MESSAGE) — no se reescribe acá.
            remove(productId)
              .then(() => toast.success("Producto eliminado"))
              .catch((err) =>
                toast.error(
                  err instanceof Error ? err.message : "No se pudo eliminar el producto",
                ),
              );
          }}
        />
      )}
    </div>
  );
}
