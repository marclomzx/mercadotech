import { Suspense } from "react";

import { LoadingState } from "@/components/shared/LoadingState";

import { CatalogView } from "../CatalogView";

type BuscarPageProps = {
  searchParams: Promise<{ q?: string }>;
};

// El título se arma server-side con el `q` de la URL; el filtrado real lo
// hace CatalogView (cliente) leyendo el mismo `q` con su propio
// useSearchParams — ambos apuntan a la misma URL, no hay dos fuentes.
export default async function BuscarPage({ searchParams }: BuscarPageProps) {
  const { q } = await searchParams;
  const title = q ? `Resultados para «${q}»` : "Buscar productos";

  return (
    <Suspense fallback={<LoadingState lines={6} />}>
      <CatalogView title={title} />
    </Suspense>
  );
}
