import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Profile } from "@/types/user";

type UserMenuProps = {
  user: Pick<Profile, "id" | "display_name" | "role"> | null;
  onLogout?: () => void;
};

function initialsFrom(name: string | null): string {
  if (!name) return "U";
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

// user/onLogout llegan por props — se conecta a useAuth() en la Fase 3.3.
export function UserMenu({ user, onLogout }: UserMenuProps) {
  if (!user) {
    return (
      <Link href="/login" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Ingresar
      </Link>
    );
  }

  const canSell = user.role === "seller" || user.role === "admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="rounded-full" />}
        aria-label="Menú de usuario"
        data-testid="user-menu"
      >
        <Avatar>
          <AvatarFallback>{initialsFrom(user.display_name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href="/pedidos" />} data-testid="user-menu-orders">
          Mis pedidos
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/favoritos" />}>Favoritos</DropdownMenuItem>
        {/* Omitidas a propósito en la sesión 3 (todavía no existían estas
            rutas) — decisión 3 de la Fase 4.7. */}
        <DropdownMenuItem render={<Link href="/asistente" />}>Asistente</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/soporte" />}>Soporte</DropdownMenuItem>
        {canSell && (
          <DropdownMenuItem
            render={<Link href="/vendedor/productos" />}
            data-testid="user-menu-seller-panel"
          >
            Panel vendedor
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} data-testid="user-menu-logout">
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
