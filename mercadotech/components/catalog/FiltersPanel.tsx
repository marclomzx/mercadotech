"use client";

import { SlidersHorizontal } from "lucide-react";

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
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SORT_OPTIONS, type SortOption } from "@/lib/constants/catalog";
import { PRODUCT_CONDITIONS, type ProductCondition } from "@/lib/constants/roles";
import { cn } from "@/lib/utils";

export type FiltersValue = {
  condition: ProductCondition[];
  minPrice?: number;
  maxPrice?: number;
  sort: SortOption;
};

type FiltersPanelProps = {
  value: FiltersValue;
  onChange: (patch: Partial<FiltersValue>) => void;
  className?: string;
};

const CONDITION_LABELS: Record<ProductCondition, string> = {
  nuevo: "Nuevo",
  usado: "Usado",
  reacondicionado: "Reacondicionado",
};

// Puro: value + onChange, sin fetching ni conocimiento de la URL — quien lo
// use (CatalogView, en app/) decide cómo persistir el patch.
function FiltersFields({ value, onChange }: Omit<FiltersPanelProps, "className">) {
  function toggleCondition(condition: ProductCondition) {
    const next = value.condition.includes(condition)
      ? value.condition.filter((c) => c !== condition)
      : [...value.condition, condition];
    onChange({ condition: next });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="filters-sort">Orden</Label>
        <Select
          value={value.sort}
          onValueChange={(sort) => onChange({ sort: sort as SortOption })}
        >
          <SelectTrigger id="filters-sort" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Condición</legend>
        <div className="space-y-1.5">
          {PRODUCT_CONDITIONS.map((condition) => (
            <label key={condition} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.condition.includes(condition)}
                onChange={() => toggleCondition(condition)}
                className="size-4 rounded border-border"
              />
              {CONDITION_LABELS[condition]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label>Precio</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Mín"
            value={value.minPrice ?? ""}
            onChange={(event) =>
              onChange({ minPrice: event.target.value ? Number(event.target.value) : undefined })
            }
            aria-label="Precio mínimo"
          />
          <span aria-hidden="true" className="text-muted-foreground">
            –
          </span>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="Máx"
            value={value.maxPrice ?? ""}
            onChange={(event) =>
              onChange({ maxPrice: event.target.value ? Number(event.target.value) : undefined })
            }
            aria-label="Precio máximo"
          />
        </div>
      </div>
    </div>
  );
}

export function FiltersPanel({ value, onChange, className }: FiltersPanelProps) {
  return (
    <>
      {/* Desktop: columna fija junto al grid. */}
      <aside className={cn("hidden md:block", className)}>
        <FiltersFields value={value} onChange={onChange} />
      </aside>

      {/* Móvil: mismos campos dentro de un sheet. */}
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger render={<Button variant="outline" className="gap-2" />}>
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filtros
          </SheetTrigger>
          <SheetContent side="left">
            <SheetTitle>Filtros</SheetTitle>
            <div className="pt-4">
              <FiltersFields value={value} onChange={onChange} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
