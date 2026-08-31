"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type NavLinkProps = ComponentProps<typeof Link> & {
  activeClassName?: string;
};

// usePathname es un hook de enrutamiento de Next.js, no de hooks/ del
// proyecto — resaltar el link activo es presentación, no lógica de negocio.
export function NavLink({
  href,
  className,
  activeClassName,
  ...props
}: NavLinkProps) {
  const pathname = usePathname();
  const hrefString = href.toString();
  const isActive = pathname === hrefString || pathname.startsWith(`${hrefString}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        className,
        isActive ? (activeClassName ?? "text-foreground font-medium") : "text-muted-foreground",
      )}
      {...props}
    />
  );
}
