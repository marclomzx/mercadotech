"use client";

import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchBarProps = {
  onSearch?: (query: string) => void;
  defaultValue?: string;
  className?: string;
};

// El componente solo expone onSearch(query); a quién navega con ese valor lo
// decide quien lo use (conectado a /buscar?q= en la Fase 3.4, junto con
// useCategories). La pestaña "Resultados con IA" de /buscar (Fase 4.4) lee
// el mismo ?q= — este componente no sabe nada de eso.
//
// onSearch es opcional y el default vive ACÁ (Client Component), no en quien
// lo renderiza: un layout Server Component no puede pasar una función nueva
// a través del límite server/client (React la rechaza al serializar props).
export function SearchBar({ onSearch = () => {}, defaultValue = "", className }: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSearch(query.trim());
  }

  return (
    <form onSubmit={handleSubmit} role="search" className={cn("flex items-center gap-2", className)}>
      <Input
        type="search"
        placeholder="Buscar productos..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Buscar productos"
      />
      <Button type="submit" size="icon" variant="outline" aria-label="Buscar">
        <Search className="size-4" />
      </Button>
    </form>
  );
}
