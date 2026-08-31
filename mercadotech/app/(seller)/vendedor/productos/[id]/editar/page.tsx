import { ProductFormView } from "../../../ProductFormView";

type EditarProductoPageProps = {
  params: Promise<{ id: string }>;
};

export default async function VendedorEditarProductoPage({ params }: EditarProductoPageProps) {
  const { id } = await params;
  // Con productId → modo edit (misma vista y mismo hook que publicar).
  return <ProductFormView productId={id} />;
}
