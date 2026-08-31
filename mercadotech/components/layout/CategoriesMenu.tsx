import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Database } from "@/types/database";
import { cn } from "@/lib/utils";

type Category = Database["public"]["Tables"]["categories"]["Row"];

type CategoriesMenuProps = {
  categories: Category[];
  className?: string;
};

// Lista de categorías por props — se conecta a useCategories en la Fase 3.4.
export function CategoriesMenu({ categories, className }: CategoriesMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className={cn("gap-1", className)} />}
      >
        Categorías
        <ChevronDown className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {categories.length === 0 ? (
          <DropdownMenuItem disabled>Sin categorías</DropdownMenuItem>
        ) : (
          categories.map((category) => (
            <DropdownMenuItem key={category.id} render={<Link href={`/categoria/${category.slug}`} />}>
              {category.name}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
