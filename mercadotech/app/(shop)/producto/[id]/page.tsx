import { ProductDetailView } from "./ProductDetailView";

type ProductoPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductoPage({ params }: ProductoPageProps) {
  const { id } = await params;
  return <ProductDetailView productId={id} />;
}
