"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useCarrinho } from "@/contexts/CarrinhoContext";
import HeaderTotem from "@/components/totem/HeaderTotem";
import { formatarMoeda } from "@/lib/utils";

interface Adicional {
  id: string;
  nome: string;
  preco: string;
}

interface ProdutoDetalhe {
  id: string;
  nome: string;
  descricao: string;
  preco: string;
  fotoUrl: string | null;
  destaque: boolean;
  adicionais: Array<{ adicional: Adicional }>;
}

export default function Detalheproduto() {
  const router = useRouter();
  const params = useParams();
  const { adicionarItem } = useCarrinho();

  const [produto, setProduto] = useState<ProdutoDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [adicionaisSelecionados, setAdicionaisSelecionados] = useState<Set<string>>(new Set());
  const [observacao, setObservacao] = useState("");
  const [quantidade, setQuantidade] = useState(1);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/produtos/${params.id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setProduto(res.data);
      })
      .finally(() => setCarregando(false));
  }, [params.id]);

  const toggleAdicional = useCallback((id: string) => {
    setAdicionaisSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }, []);

  const precoBase = produto ? parseFloat(produto.preco) : 0;
  const precoAdicionais = produto
    ? produto.adicionais
        .filter((a) => adicionaisSelecionados.has(a.adicional.id))
        .reduce((s, a) => s + parseFloat(a.adicional.preco), 0)
    : 0;
  const precoTotal = (precoBase + precoAdicionais) * quantidade;

  const adicionarAoCarrinho = useCallback(() => {
    if (!produto) return;
    adicionarItem({
      produtoId: produto.id,
      nome: produto.nome,
      preco: parseFloat(produto.preco),
      quantidade,
      observacao: observacao || undefined,
      adicionais: produto.adicionais
        .filter((a) => adicionaisSelecionados.has(a.adicional.id))
        .map((a) => ({
          adicionalId: a.adicional.id,
          nome: a.adicional.nome,
          preco: parseFloat(a.adicional.preco),
        })),
      fotoUrl: produto.fotoUrl,
    });
    router.push("/cardapio");
  }, [produto, quantidade, observacao, adicionaisSelecionados, adicionarItem, router]);

  if (carregando) {
    return (
      <div className="h-full flex flex-col">
        <HeaderTotem />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-cb-latte text-xl">Carregando...</div>
        </div>
      </div>
    );
  }

  if (!produto) {
    return (
      <div className="h-full flex flex-col">
        <HeaderTotem />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <span className="text-5xl">😕</span>
          <p className="text-cb-latte text-xl">Produto não encontrado</p>
          <button onClick={() => router.push("/cardapio")} className="bg-cb-amber text-cb-espresso font-bold px-8 py-4 rounded-full">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <HeaderTotem />

      {/* Conteúdo com scroll */}
      <div className="flex-1 overflow-y-auto totem-scroll">
        {/* Foto */}
        <div className="relative w-full h-56 bg-gradient-to-br from-cb-mocha to-cb-caramel">
          {produto.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={produto.fotoUrl} alt={produto.nome} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-7xl opacity-30">☕</span>
            </div>
          )}
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Nome e Preço base */}
          <div>
            <h1 className="font-display text-3xl text-cb-cream font-bold">{produto.nome}</h1>
            <p className="font-sans text-cb-latte mt-2 text-base leading-relaxed">{produto.descricao}</p>
            <p className="font-display text-2xl text-cb-gold font-bold mt-3">
              {formatarMoeda(produto.preco)}
            </p>
          </div>

          {/* Adicionais */}
          {produto.adicionais.length > 0 && (
            <div>
              <h2 className="font-display text-xl text-cb-cream font-semibold mb-3">Adicionais</h2>
              <div className="flex flex-col gap-2">
                {produto.adicionais.map(({ adicional }) => {
                  const selecionado = adicionaisSelecionados.has(adicional.id);
                  return (
                    <button
                      key={adicional.id}
                      onClick={() => toggleAdicional(adicional.id)}
                      className={`
                        flex items-center justify-between px-5 py-4 rounded-2xl
                        border-2 touch-manipulation transition-all active:scale-95 min-h-[64px]
                        ${selecionado
                          ? "border-cb-amber bg-cb-amber/10 text-cb-cream"
                          : "border-cb-caramel/30 bg-cb-mocha text-cb-latte"
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-bold
                          ${selecionado ? "border-cb-amber bg-cb-amber text-cb-espresso" : "border-cb-caramel"}`}>
                          {selecionado ? "✓" : ""}
                        </span>
                        <span className="font-sans text-base">{adicional.nome}</span>
                      </div>
                      {parseFloat(adicional.preco) > 0 && (
                        <span className="font-sans text-cb-gold font-semibold">
                          +{formatarMoeda(adicional.preco)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Observação */}
          <div>
            <h2 className="font-display text-xl text-cb-cream font-semibold mb-3">Observação</h2>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Alguma observação? (ex: sem açúcar, leite por último...)"
              className="w-full bg-cb-mocha border border-cb-caramel/30 rounded-2xl p-4 text-cb-cream
                         font-sans text-base placeholder:text-cb-caramel resize-none h-24
                         focus:outline-none focus:border-cb-amber"
            />
          </div>

          {/* Espaçador para o rodapé fixo */}
          <div className="h-32" />
        </div>
      </div>

      {/* Rodapé fixo */}
      <div className="shrink-0 bg-cb-dark border-t border-cb-caramel/20 p-4 flex items-center gap-4">
        {/* Controle de quantidade */}
        <div className="flex items-center gap-3 bg-cb-mocha rounded-full px-2 py-1">
          <button
            onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
            className="w-12 h-12 rounded-full bg-cb-espresso text-cb-cream font-bold text-xl
                       touch-manipulation active:scale-90 transition-transform"
          >
            −
          </button>
          <span className="font-display text-2xl text-cb-gold font-bold w-8 text-center">
            {quantidade}
          </span>
          <button
            onClick={() => setQuantidade((q) => q + 1)}
            className="w-12 h-12 rounded-full bg-cb-amber text-cb-espresso font-bold text-xl
                       touch-manipulation active:scale-90 transition-transform"
          >
            +
          </button>
        </div>

        {/* Botão adicionar */}
        <button
          onClick={adicionarAoCarrinho}
          className="flex-1 bg-cb-amber text-cb-espresso font-bold font-sans text-lg
                     py-4 rounded-full touch-manipulation active:scale-95 transition-transform
                     min-h-[64px]"
        >
          Adicionar — {formatarMoeda(precoTotal)}
        </button>
      </div>
    </div>
  );
}
