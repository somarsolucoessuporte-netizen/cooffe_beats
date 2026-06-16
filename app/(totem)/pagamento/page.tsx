"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { playClick } from "@/lib/sounds";
import { useCarrinho } from "@/contexts/CarrinhoContext";
import HeaderTotem from "@/components/totem/HeaderTotem";
import { formatarMoeda } from "@/lib/utils";
import { criarCobranca, verificarPagamento } from "@/lib/sumup";
import { iniciarPagamentoNFC } from "@/lib/sunmi";

type Tela = "escolha" | "pix" | "cartao";

const DEMO = process.env.NEXT_PUBLIC_PAGAMENTO_SIMULADO === "true";
const POLL_MS = 3_000;
const TIMEOUT_MS = 5 * 60 * 1_000;

// QR Code visual para modo demo
function QRFakeDemo() {
  const G = [
    [1,1,1,1,1,1,1,0,0,1,0,0,1,0,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,1,0,1,0,0,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,0,1,0,1,1,0,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,1,1,1,0,0,1,1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1,0,0,0,1,0,1,0,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,1,0,0,1,0,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,1,1,0,1,0,1,0,0,0,0,0,0,0],
    [0,1,1,0,1,0,1,1,1,0,1,0,1,0,1,1,0,1,0,1,0],
    [1,0,0,1,0,1,0,1,0,1,1,0,0,1,1,0,1,0,0,1,1],
    [0,0,1,0,1,0,1,0,1,0,1,0,1,1,0,1,0,1,1,0,1],
    [0,1,0,1,0,0,0,0,0,1,0,1,0,0,1,0,1,0,0,1,0],
    [1,1,0,1,1,0,1,1,1,0,1,0,1,0,0,1,0,1,1,0,1],
    [0,0,0,0,0,0,0,0,1,0,0,1,0,1,1,0,1,0,0,1,0],
    [1,1,1,1,1,1,1,0,1,1,0,0,1,0,1,0,1,1,0,1,0],
    [1,0,0,0,0,0,1,0,0,1,0,1,0,1,0,1,0,0,1,0,1],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,0,1,0,1,1,0],
    [1,0,1,1,1,0,1,0,1,1,0,1,0,0,0,1,0,1,0,0,1],
    [1,0,1,1,1,0,1,0,0,0,1,0,1,0,1,0,1,1,1,0,0],
    [1,0,0,0,0,0,1,0,1,0,0,1,0,1,0,1,0,0,0,1,1],
    [1,1,1,1,1,1,1,0,0,1,0,0,1,0,1,0,1,0,1,0,0],
  ] as const;
  const C = 9;
  const S = 21 * C;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${S} ${S}`} width={S} height={S}
         style={{ background: "white", borderRadius: 8, display: "block" }}>
      {G.map((row, r) =>
        row.map((cell, c) =>
          cell === 1
            ? <rect key={`${r}-${c}`} x={c * C} y={r * C} width={C} height={C} fill="#3B2415" />
            : null
        )
      )}
    </svg>
  );
}

export default function Pagamento() {
  const router = useRouter();
  const { itens, totalValor, empresaId, limparCarrinho } = useCarrinho();

  const [tela, setTela] = useState<Tela>("escolha");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [contador, setContador] = useState(0);

  const pedidoRef = useRef<{ id: string; senha: string } | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalRef = useRef(totalValor);
  totalRef.current = totalValor;

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Countdown para modo demo
  useEffect(() => {
    if (!DEMO || contador <= 0 || tela === "escolha") return;
    const t = setTimeout(async () => {
      const next = contador - 1;
      setContador(next);
      if (next === 0 && pedidoRef.current) {
        const { id, senha } = pedidoRef.current;
        try {
          await fetch("/api/pagamentos/simular", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pedidoId: id, valor: totalRef.current }),
          });
        } catch { /* silencioso */ }
        limparCarrinho();
        router.push(`/confirmacao?senha=${encodeURIComponent(senha)}&id=${id}`);
      }
    }, 1_000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contador, tela]);

  const pararPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const iniciarPolling = useCallback((checkoutId: string) => {
    pararPolling();

    timeoutRef.current = setTimeout(() => {
      pararPolling();
      setErro("Tempo de pagamento expirado. Tente novamente.");
      setTela("escolha");
    }, TIMEOUT_MS);

    pollingRef.current = setInterval(async () => {
      try {
        const status = await verificarPagamento(checkoutId);
        if (status.status === "PAID" && pedidoRef.current) {
          pararPolling();
          const { id, senha } = pedidoRef.current;
          limparCarrinho();
          router.push(`/confirmacao?senha=${encodeURIComponent(senha)}&id=${id}`);
        } else if (status.status === "FAILED") {
          pararPolling();
          setErro("Pagamento recusado. Tente novamente.");
          setTela("escolha");
        }
      } catch { /* manter polling em erros de rede */ }
    }, POLL_MS);
  }, [limparCarrinho, router]);

  const criarPedido = useCallback(async () => {
    const res = await fetch("/api/pedidos", {
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
    const dados = await res.json();
    if (!dados.ok) throw new Error(dados.error ?? "Erro ao criar pedido");
    return dados.data as { id: string; senha: string };
  }, [empresaId, itens]);

  const selecionarMetodo = useCallback(async (metodo: "PIX" | "CARTAO") => {
    if (carregando || itens.length === 0) return;
    playClick();
    setCarregando(true);
    setErro(null);

    try {
      const pedido = await criarPedido();
      pedidoRef.current = pedido;

      if (DEMO) {
        setTela(metodo === "PIX" ? "pix" : "cartao");
        setContador(metodo === "PIX" ? 5 : 3);
        setCarregando(false);
        return;
      }

      if (metodo === "CARTAO") iniciarPagamentoNFC(totalValor);

      const checkout = await criarCobranca({
        valor: totalValor,
        descricao: `Coffee & Beats – ${pedido.senha}`,
        referencia: `CB-${pedido.senha}-${Date.now()}`,
        metodo,
      });

      if (metodo === "PIX" && checkout.qr_code) setQrCode(checkout.qr_code);
      setTela(metodo === "PIX" ? "pix" : "cartao");
      setCarregando(false);
      iniciarPolling(checkout.checkout_id);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao iniciar pagamento");
      setCarregando(false);
    }
  }, [carregando, itens, totalValor, criarPedido, iniciarPolling]);

  // Botão "Simulado" legado (fluxo direto, para testes rápidos em dev)
  const processarSimulado = useCallback(async () => {
    if (carregando || itens.length === 0) return;
    playClick();
    setCarregando(true);
    setErro(null);
    try {
      const pedido = await criarPedido();
      await new Promise((r) => setTimeout(r, 1_000));
      await fetch("/api/pagamentos/simular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId: pedido.id, valor: totalValor }),
      });
      limparCarrinho();
      router.push(`/confirmacao?senha=${encodeURIComponent(pedido.senha)}&id=${pedido.id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao processar pagamento");
      setCarregando(false);
    }
  }, [carregando, itens, totalValor, criarPedido, limparCarrinho, router]);

  const voltarEscolha = () => {
    pararPolling();
    setTela("escolha");
    setQrCode(null);
    setContador(0);
    setErro(null);
  };

  // ---------- TELA PIX ----------
  if (tela === "pix") {
    return (
      <div className="h-full flex flex-col animate-fadeIn">
        <HeaderTotem />
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
          <h1 className="font-sans font-extrabold text-3xl text-cb-marrom">Pagamento via PIX</h1>
          <p className="text-cb-marrom/60 text-lg">
            Total: <span className="text-cb-amber font-extrabold">{formatarMoeda(totalValor)}</span>
          </p>

          <div className="flex flex-col items-center gap-4 bg-white rounded-3xl p-6 shadow-sm">
            {DEMO ? (
              <>
                <QRFakeDemo />
                <p className="text-cb-marrom/50 text-sm">Escaneie com o app do banco</p>
                <div className="flex items-center gap-2">
                  <span className="text-cb-marrom font-extrabold text-5xl font-mono">{contador}</span>
                  <span className="text-cb-marrom/60 text-lg">segundos</span>
                </div>
                <p className="text-green-600 font-semibold text-sm animate-pulse">
                  ✓ Aguardando confirmação do pagamento...
                </p>
              </>
            ) : qrCode ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCode} alt="QR Code PIX" width={189} height={189} className="rounded-lg" />
                <p className="text-cb-marrom/50 text-sm">Escaneie com o app do banco</p>
                <p className="text-green-600 font-semibold text-sm animate-pulse">
                  ✓ Aguardando confirmação do pagamento...
                </p>
              </>
            ) : (
              <>
                <div className="w-48 h-48 bg-cb-marrom/10 rounded-lg flex items-center justify-center">
                  <span className="text-cb-marrom/40 text-sm">Gerando QR Code...</span>
                </div>
                <p className="text-cb-marrom/50 text-sm animate-pulse">Aguarde um momento</p>
              </>
            )}
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-300 rounded-2xl px-6 py-3 text-red-600 text-sm">
              {erro}
            </div>
          )}

          <button
            onClick={voltarEscolha}
            className="text-cb-marrom/50 text-sm underline underline-offset-4"
          >
            ← Escolher outra forma de pagamento
          </button>
        </div>
      </div>
    );
  }

  // ---------- TELA CARTÃO ----------
  if (tela === "cartao") {
    return (
      <div className="h-full flex flex-col animate-fadeIn">
        <HeaderTotem />
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
          <h1 className="font-sans font-extrabold text-3xl text-cb-marrom">Pagamento com Cartão</h1>
          <p className="text-cb-marrom/60 text-lg">
            Total: <span className="text-cb-amber font-extrabold">{formatarMoeda(totalValor)}</span>
          </p>

          <div className="flex flex-col items-center gap-6 bg-white rounded-3xl p-10 shadow-sm">
            <span className="text-8xl animate-bounce">💳</span>
            <p className="font-extrabold text-cb-marrom text-2xl text-center">
              Aproxime ou insira seu cartão
            </p>
            <p className="text-cb-marrom/50 text-sm text-center">
              Aceita débito, crédito e NFC
            </p>
            {DEMO && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-cb-marrom font-extrabold text-5xl font-mono">{contador}</span>
                <span className="text-cb-marrom/60 text-lg">segundos</span>
              </div>
            )}
            <p className="text-green-600 font-semibold text-sm animate-pulse">
              ✓ Aguardando leitura do cartão...
            </p>
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-300 rounded-2xl px-6 py-3 text-red-600 text-sm">
              {erro}
            </div>
          )}

          <button
            onClick={voltarEscolha}
            className="text-cb-marrom/50 text-sm underline underline-offset-4"
          >
            ← Escolher outra forma de pagamento
          </button>
        </div>
      </div>
    );
  }

  // ---------- TELA ESCOLHA ----------
  return (
    <div className="h-full flex flex-col animate-fadeIn">
      <HeaderTotem />

      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        <div className="text-center">
          <h1 className="font-sans font-extrabold text-4xl text-cb-marrom">Como deseja pagar?</h1>
          <p className="text-cb-marrom/60 mt-2 text-xl">
            Total:{" "}
            <span className="text-cb-amber font-extrabold">{formatarMoeda(totalValor)}</span>
          </p>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-300 rounded-2xl px-6 py-4 text-red-600 text-base">
            {erro}
          </div>
        )}

        <div className="grid grid-cols-2 gap-5 w-full max-w-xl">
          {/* PIX */}
          <button
            onClick={() => selecionarMetodo("PIX")}
            disabled={carregando}
            className="flex flex-col items-center gap-3 bg-white border-2 border-cb-marrom/20
                       rounded-2xl p-6 min-h-[130px] touch-manipulation btn-totem
                       hover:border-cb-amber hover:bg-cb-bege/50 transition-colors
                       disabled:opacity-60"
          >
            <span className="text-4xl">📱</span>
            <span className="font-sans font-extrabold text-cb-marrom">PIX</span>
            <span className="text-xs text-cb-marrom/60">Instantâneo</span>
          </button>

          {/* Cartão */}
          <button
            onClick={() => selecionarMetodo("CARTAO")}
            disabled={carregando}
            className="flex flex-col items-center gap-3 bg-white border-2 border-cb-marrom/20
                       rounded-2xl p-6 min-h-[130px] touch-manipulation btn-totem
                       hover:border-cb-amber hover:bg-cb-bege/50 transition-colors
                       disabled:opacity-60"
          >
            <span className="text-4xl">💳</span>
            <span className="font-sans font-extrabold text-cb-marrom">Cartão</span>
            <span className="text-xs text-cb-marrom/60">Débito ou crédito</span>
          </button>

          {/* Dinheiro */}
          <button
            disabled
            className="flex flex-col items-center gap-3 bg-white border border-cb-marrom/10
                       rounded-2xl p-6 min-h-[130px] opacity-40 cursor-not-allowed"
          >
            <span className="text-4xl">💵</span>
            <span className="font-sans font-extrabold text-cb-marrom">Dinheiro</span>
            <span className="text-xs text-cb-marrom/40">Chame um atendente</span>
          </button>

          {/* Simulado — apenas em dev/teste */}
          {DEMO && (
            <button
              onClick={processarSimulado}
              disabled={carregando}
              className="flex flex-col items-center gap-3 bg-cb-marrom/80 text-cb-bege
                         rounded-2xl p-6 min-h-[130px] touch-manipulation btn-totem
                         font-extrabold disabled:opacity-70 border border-cb-marrom/20"
            >
              {carregando ? (
                <>
                  <span className="text-4xl animate-spin">⟳</span>
                  <span className="font-sans font-extrabold">Processando...</span>
                </>
              ) : (
                <>
                  <span className="text-4xl">🧪</span>
                  <span className="font-sans font-extrabold">Simulado</span>
                  <span className="text-xs opacity-60">Apenas em teste</span>
                </>
              )}
            </button>
          )}
        </div>

        {carregando && (
          <p className="text-cb-marrom/50 text-sm animate-pulse">Criando pedido...</p>
        )}
      </div>
    </div>
  );
}
