import { carregarCardapioWeb } from "@/lib/cardapio-web";
import CardapioMesa from "./CardapioMesa";

export const dynamic = "force-dynamic";

// Cardápio mobile dedicado da mesa (QR → /mesa/{id} → /web/m?mesa={id})
// Sem login: o cliente se identifica por nome+WhatsApp em /mesa/{id}
export default async function CardapioMesaPage({
  searchParams,
}: {
  searchParams: Promise<{ mesa?: string; cliente?: string; wpp?: string }>;
}) {
  const query = await searchParams;
  const { categorias, produtosIniciais, categoriaInicialId } = await carregarCardapioWeb();

  return (
    <CardapioMesa
      categorias={categorias}
      produtosIniciais={produtosIniciais}
      categoriaInicialId={categoriaInicialId}
      mesaQuery={query.mesa ?? ""}
      clienteQuery={query.cliente ?? ""}
      wppQuery={query.wpp ?? ""}
    />
  );
}
