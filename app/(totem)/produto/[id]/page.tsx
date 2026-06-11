"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useCarrinho } from "@/contexts/CarrinhoContext";
import HeaderTotem from "@/components/totem/HeaderTotem";
import { formatarMoeda } from "@/lib/utils";
import { playClick } from "@/lib/sounds";

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

export default function DetalheProduto() {
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
      .then((res) => { if (res.ok) setProduto(res.data); })
      .finally(() => setCarregando(false));
  }, [params.id]);

  const toggleAdicional = useCallback((id: string) => {
    setAdicionaisSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  }, []);

  const precoBase      = produto ? parseFloat(produto.preco) : 0;
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
          <div className="text-cb-marrom/50 text-xl">Carregando...</div>
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
          <p className="text-cb-marrom/70 text-xl">Produto não encontrado</p>
          <button
            onClick={() => router.push("/cardapio")}
            className="bg-cb-marrom text-cb-bege font-bold px-8 py-4 rounded-full"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      <HeaderTotem />

      <div className="flex-1 overflow-y-auto totem-scroll">
        {/* Foto */}
        <div className="relative w-full h-56 bg-cb-bege">
          {produto.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={produto.fotoUrl} alt={produto.nome} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-7xl opacity-20">☕</span>
            </div>
          )}
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Nome e Preço */}
          <div>
            <h1 className="font-sans font-extrabold text-3xl text-cb-marrom">{produto.nome}</h1>
            <p className="text-cb-marrom/70 mt-2 text-base leading-relaxed">{produto.descricao}</p>
            <p className="font-extrabold text-2xl text-cb-amber mt-3">
              {formatarMoeda(produto.preco)}
            </p>
          </div>

          {/* Adicionais */}
          {produto.adicionais.length > 0 && (
            <div>
              <h2 className="font-sans font-extrabold text-xl text-cb-marrom mb-3">Adicionais</h2>
              <div className="flex flex-col gap-2">
                {produto.adicionais.map(({ adicional }) => {
                  const sel = adicionaisSelecionados.has(adicional.id);
                  return (
                    <button
                      key={adicional.id}
                      onClick={() => { playClick(); toggleAdicional(adicional.id); }}
                      className={`flex items-center justify-between px-5 py-4 rounded-2xl
                        border-2 touch-manipulation transition-all active:scale-95 min-h-[64px]
                        ${sel
                          ? "border-cb-amber bg-cb-amber/10 text-cb-marrom"
                          : "border-cb-marrom/20 bg-white text-cb-marrom"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-bold
                          ${sel ? "border-cb-amber bg-cb-amber text-cb-bege" : "border-cb-marrom/30"}`}>
                          {sel ? "✓" : ""}
                        </span>
                        <span className="font-sans text-base">{adicional.nome}</span>
                      </div>
                      {parseFloat(adicional.preco) > 0 && (
                        <span className="font-sans text-cb-amber font-semibold">
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
            <h2 className="font-sans font-extrabold text-xl text-cb-marrom mb-3">Observação</h2>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Alguma observação? (ex: sem açúcar, leite por último...)"
              className="w-full bg-white border border-cb-marrom/20 rounded-2xl p-4 text-cb-marrom
                         font-sans text-base placeholder:text-cb-marrom/30 resize-none h-24
                         focus:outline-none focus:border-cb-amber"
            />
          </div>

          <div className="h-32" />
        </div>
      </div>

      {/* Rodapé fixo */}
      <div className="shrink-0 bg-white border-t border-cb-marrom/10 p-4 flex items-center gap-4">
        <div className="flex items-center gap-3 bg-cb-bege rounded-full px-2 py-1">
          <button
            onClick={() => { playClick(); setQuantidade((q) => Math.max(1, q - 1)); }}
            className="w-12 h-12 rounded-full bg-cb-marrom/10 text-cb-marrom font-bold text-xl
                       touch-manipulation btn-totem"
          >
            −
          </button>
          <span className="font-sans font-extrabold text-2xl text-cb-marrom w-8 text-center">
            {quantidade}
          </span>
          <button
            onClick={() => { playClick(); setQuantidade((q) => q + 1); }}
            className="w-12 h-12 rounded-full bg-cb-marrom text-cb-bege font-bold text-xl
                       touch-manipulation btn-totem"
          >
            +
          </button>
        </div>

        <button
          onClick={() => { playClick(); adicionarAoCarrinho(); }}
          className="flex-1 bg-cb-marrom text-cb-bege font-extrabold font-sans text-lg
                     py-4 rounded-full touch-manipulation btn-totem min-h-[64px]"
        >
          Adicionar — {formatarMoeda(precoTotal)}
        </button>
      </div>
    </div>
  );
}
