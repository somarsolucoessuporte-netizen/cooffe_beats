"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { playClick } from "@/lib/sounds";
import { useCarrinho } from "@/contexts/CarrinhoContext";
import HeaderTotem from "@/components/totem/HeaderTotem";
import { formatarMoeda } from "@/lib/utils";

export default function Pagamento() {
  const router = useRouter();
  const { itens, totalValor, empresaId, limparCarrinho } = useCarrinho();
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pagamentoSimuladoAtivo = process.env.NEXT_PUBLIC_PAGAMENTO_SIMULADO === "true";

  const processarPagamento = useCallback(async () => {
    if (processando || itens.length === 0) return;
    setProcessando(true);
    setErro(null);

    try {
      // Cria o pedido
      const resPedido = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId,
          itens: itens.map((item) => ({
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            precoUnit: item.preco,
            observacao: item.observacao,
            adicionais: item.adicionais.map((a) => ({
              adicionalId: a.adicionalId,
              preco: a.preco,
            })),
          })),
        }),
      });

      const dadosPedido = await resPedido.json();
      if (!dadosPedido.ok) throw new Error(dadosPedido.error);

      const pedidoId = dadosPedido.data.id;
      const senha = dadosPedido.data.senha;

      // Simula pagamento
      await new Promise((res) => setTimeout(res, 1500));

      await fetch("/api/pagamentos/simular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId, valor: totalValor }),
      });

      limparCarrinho();
      router.push(`/confirmacao?senha=${encodeURIComponent(senha)}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao processar pagamento");
      setProcessando(false);
    }
  }, [processando, itens, empresaId, totalValor, limparCarrinho, router]);

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      <HeaderTotem />

      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        <div className="text-center">
          <h1 className="font-display text-4xl text-cb-cream font-bold">Como deseja pagar?</h1>
          <p className="font-sans text-cb-latte mt-2 text-xl">
            Total: <span className="text-cb-gold font-bold">{formatarMoeda(totalValor)}</span>
          </p>
        </div>

        {erro && (
          <div className="bg-red-900/40 border border-red-700 rounded-2xl px-6 py-4 text-red-300 font-sans text-base">
            {erro}
          </div>
        )}

        <div className="grid grid-cols-2 gap-5 w-full max-w-xl">
          {/* PIX */}
          <button
            disabled
            className="flex flex-col items-center gap-3 bg-cb-mocha border border-cb-caramel/30
                       rounded-2xl p-6 min-h-[130px] opacity-50 cursor-not-allowed"
          >
            <span className="text-4xl">📱</span>
            <span className="font-sans font-semibold text-cb-cream">PIX</span>
            <span className="font-sans text-xs text-cb-caramel">Em breve</span>
          </button>

          {/* Cartão */}
          <button
            disabled
            className="flex flex-col items-center gap-3 bg-cb-mocha border border-cb-caramel/30
                       rounded-2xl p-6 min-h-[130px] opacity-50 cursor-not-allowed"
          >
            <span className="text-4xl">💳</span>
            <span className="font-sans font-semibold text-cb-cream">Cartão</span>
            <span className="font-sans text-xs text-cb-caramel">Em breve</span>
          </button>

          {/* Dinheiro */}
          <button
            disabled
            className="flex flex-col items-center gap-3 bg-cb-mocha border border-cb-caramel/30
                       rounded-2xl p-6 min-h-[130px] opacity-50 cursor-not-allowed"
          >
            <span className="text-4xl">💵</span>
            <span className="font-sans font-semibold text-cb-cream">Dinheiro</span>
            <span className="font-sans text-xs text-cb-caramel">Chame um atendente</span>
          </button>

          {/* Simulado — apenas em dev */}
          {pagamentoSimuladoAtivo && (
            <button
              onClick={() => { playClick(); processarPagamento(); }}
              disabled={processando}
              className="flex flex-col items-center gap-3 bg-cb-amber text-cb-espresso
                         rounded-2xl p-6 min-h-[130px] touch-manipulation btn-totem
                         font-bold disabled:opacity-70"
            >
              {processando ? (
                <>
                  <span className="text-4xl animate-spin">⟳</span>
                  <span className="font-sans font-bold">Processando...</span>
                </>
              ) : (
                <>
                  <span className="text-4xl">🧪</span>
                  <span className="font-sans font-bold">Simulado</span>
                  <span className="font-sans text-xs opacity-70">Apenas em teste</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
