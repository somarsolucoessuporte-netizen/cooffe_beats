import CardapioWebClient from "./CardapioClient";
import MobileSplash from "@/components/web/MobileSplash";
import { carregarCardapioWeb } from "@/lib/cardapio-web";

export const dynamic = "force-dynamic";

export default async function WebCardapioPage() {
  const { categorias, produtosIniciais, categoriaInicialId } = await carregarCardapioWeb();

  return (
    <>
    {/* Splash animada — só mobile, uma vez por sessão */}
    <MobileSplash />
    <CardapioWebClient
      categorias={categorias}
      produtosIniciais={produtosIniciais}
      categoriaInicialId={categoriaInicialId}
    />
    </>
  );
}
