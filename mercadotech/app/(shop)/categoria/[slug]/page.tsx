import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LoadingState } from "@/components/shared/LoadingState";
import { createClient } from "@/lib/supabase/server";
import { getCategoryBySlug } from "@/services/category.service";

import { CatalogView } from "../../CatalogView";

type CategoriaPageProps = {
  params: Promise<{ slug: string }>;
};

// Server Component: resuelve la categoría con el cliente de servidor para
// poner el título real (nombre, no el slug) y devolver 404 si no existe —
// reutiliza el MISMO getCategoryBySlug que usa listActiveProducts por dentro.
export default async function CategoriaPage({ params }: CategoriaPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const category = await getCategoryBySlug(slug, supabase);

  if (!category) notFound();

  return (
    <Suspense fallback={<LoadingState lines={6} />}>
      <CatalogView title={category.name} categorySlug={slug} />
    </Suspense>
  );
}
