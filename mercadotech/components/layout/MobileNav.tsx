"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Database } from "@/types/database";

type Category = Database["public"]["Tables"]["categories"]["Row"];

type MobileNavProps = {
  categories: Category[];
};

const STATIC_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/favoritos", label: "Favoritos" },
  { href: "/carrito", label: "Carrito" },
  { href: "/pedidos", label: "Mis pedidos" },
  // Omitidas a propósito en la sesión 3 (todavía no existían estas rutas) —
  // decisión 3 de la Fase 4.7.
  { href: "/asistente", label: "Asistente" },
  { href: "/soporte", label: "Soporte" },
];

// Mismos enlaces que el Navbar de escritorio, dentro de un sheet para < md.
export function MobileNav({ categories }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" />}
        aria-label="Abrir menú"
      >
        <Menu className="size-5" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="left">
        <SheetTitle>Menú</SheetTitle>
        <nav className="flex flex-col gap-1 pt-4">
          {STATIC_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm hover:bg-muted"
            >
              {link.label}
            </Link>
          ))}
          {categories.length > 0 && (
            <>
              <p className="mt-4 px-3 text-xs font-medium text-muted-foreground">
                Categorías
              </p>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/categoria/${category.slug}`}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm hover:bg-muted"
                >
                  {category.name}
                </Link>
              ))}
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
