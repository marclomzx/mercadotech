import Link from "next/link";

import { CartIndicator } from "@/components/layout/CartIndicator";
import { CategoriesMenu } from "@/components/layout/CategoriesMenu";
import { MobileNav } from "@/components/layout/MobileNav";
import { SearchBar } from "@/components/layout/SearchBar";
import { UserMenu } from "@/components/layout/UserMenu";
import { Container } from "@/components/shared/Container";
import type { Database } from "@/types/database";
import type { Profile } from "@/types/user";

type Category = Database["public"]["Tables"]["categories"]["Row"];

type NavbarProps = {
  categories: Category[];
  cartCount: number;
  user: Pick<Profile, "id" | "display_name" | "role"> | null;
  onSearch?: (query: string) => void;
  onLogout?: () => void;
};

// Compone: logo, SearchBar, CategoriesMenu, CartIndicator, UserMenu,
// MobileNav. Todo por props — el layout que lo use decide de dónde salen
// (estático en 3.2, hooks reales desde 3.3 en adelante).
export function Navbar({ categories, cartCount, user, onSearch, onLogout }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <Container className="flex h-16 items-center gap-3">
        <MobileNav categories={categories} />
        <Link href="/" className="shrink-0 text-lg font-bold text-primary">
          MercadoTech
        </Link>
        <CategoriesMenu categories={categories} className="hidden md:inline-flex" />
        <SearchBar onSearch={onSearch} className="hidden flex-1 md:flex" />
        <div className="ml-auto flex items-center gap-1">
          <CartIndicator count={cartCount} />
          <UserMenu user={user} onLogout={onLogout} />
        </div>
      </Container>
    </header>
  );
}
