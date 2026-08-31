import { Suspense } from "react";

import { LoadingState } from "@/components/shared/LoadingState";

import { CatalogView } from "./CatalogView";

export default function HomePage() {
  return (
    <Suspense fallback={<LoadingState lines={6} />}>
      <CatalogView title="Todos los productos" />
    </Suspense>
  );
}
