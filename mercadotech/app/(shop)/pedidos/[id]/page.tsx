import { OrderDetailView } from "./OrderDetailView";

type PedidoDetallePageProps = {
  params: Promise<{ id: string }>;
};

export default async function PedidoDetallePage({ params }: PedidoDetallePageProps) {
  const { id } = await params;
  return <OrderDetailView orderId={id} />;
}
