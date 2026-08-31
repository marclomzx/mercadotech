import { LayoutGrid, ListOrdered, PlusCircle } from "lucide-react";

import { NavLink } from "@/components/layout/NavLink";

const LINKS = [
  { href: "/vendedor/productos", label: "Mis productos", icon: LayoutGrid },
  { href: "/vendedor/pedidos", label: "Pedidos", icon: ListOrdered },
  { href: "/vendedor/publicar", label: "Publicar", icon: PlusCircle },
] as const;

// Fila horizontal en móvil, columna en escritorio — se "colapsa" por CSS,
// sin estado propio.
export function SellerSidebar() {
  return (
    <nav className="flex flex-row gap-1 overflow-x-auto p-2 md:flex-col md:overflow-visible md:p-4">
      {LINKS.map(({ href, label, icon: Icon }) => (
        <NavLink
          key={href}
          href={href}
          className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap hover:bg-muted"
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
