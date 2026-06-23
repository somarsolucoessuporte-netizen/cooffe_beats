import PedidoWebClient from "./PedidoClient";

export default async function PedidoWebPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PedidoWebClient pedidoId={id} />;
}
