"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CatalogView } from "../CatalogView";
import { SemanticSearchResults } from "./SemanticSearchResults";

type BuscarViewProps = {
  title: string;
};

// Envuelve la búsqueda de la sesión 3 (intacta) y la pestaña nueva de la
// Fase 4.4 sin duplicar nada: "Coincidencia exacta" sigue siendo el MISMO
// CatalogView que usan / y /categoria/[slug] — mismo hook, mismo grid, mismo
// comportamiento para anónimos. Solo "Resultados con IA" es nuevo.
export function BuscarView({ title }: BuscarViewProps) {
  return (
    <Tabs defaultValue="exact">
      <TabsList>
        <TabsTrigger value="exact">Coincidencia exacta</TabsTrigger>
        <TabsTrigger value="semantic">Resultados con IA</TabsTrigger>
      </TabsList>

      <TabsContent value="exact">
        <CatalogView title={title} />
      </TabsContent>

      <TabsContent value="semantic">
        <SemanticSearchResults />
      </TabsContent>
    </Tabs>
  );
}
