"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useCategories } from "@/hooks/useCategories";

// Conector hook ↔ componente. Vive en app/ (no en components/) porque la
// regla de capas del proyecto prohíbe que components/ importe hooks/.
// Navbar sigue siendo puro: recibe todo por props.
export function ShopNavbar() {
  const router = useRouter();
  const { user, profile, logout } = useAuth();
  const { categories } = useCategories();
  // useCart usa un store compartido a nivel de módulo, así que este contador
  // se actualiza solo cuando se agrega algo desde el detalle del producto.
  const { count } = useCart(user?.id ?? null);

  async function handleLogout() {
    await logout();
    toast.success("Sesión cerrada");
    router.push("/");
    router.refresh();
  }

  return (
    <Navbar
      categories={categories}
      cartCount={count}
      user={profile}
      onLogout={handleLogout}
      onSearch={(query) => {
        if (query) router.push(`/buscar?q=${encodeURIComponent(query)}`);
      }}
    />
  );
}
