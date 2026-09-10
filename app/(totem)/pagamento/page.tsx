"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { playClick } from "@/lib/sounds";
import { useCarrinho } from "@/contexts/CarrinhoContext";
import HeaderTotem from "@/components/totem/HeaderTotem";
import { formatarMoeda } from "@/lib/utils";
import { iniciarPagamentoNFC } from "@/lib/sunmi";

type Tela = "escolha" | "pix" | "cartao" | "maquininha";

const DEMO = process.env.NEXT_PUBLIC_PAGAMENTO_SIMULADO === "true";

const TIMEOUT_PIX_MS        = 10 * 60 * 1000; // 10 minutos
const TIMEOUT_MAQUININHA_MS =  5 * 60 * 1000; // 5 minutos
const POLL_STATUS_MS        = 3000;
const POLL_CARTAO_MS        = 2000;

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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={"0 0 " + S + " " + S} width={S} height={S}
         style={{ background: "white", borderRadius: 8, display: "block" }}>
      {G.map(function(row, r) {
        return row.map(function(cell, c) {
          return cell === 1
            ? <rect key={r + "-" + c} x={c * C} y={r * C} width={C} height={C} fill="#3B2415" />
            : null;
        });
      })}
    </svg>
  );
}

function formatarTempo(seg: number): string {
  var m = Math.floor(seg / 60);
  var s = seg % 60;
  return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
}

export default function Pagamento() {
  const router = useRouter();
  const { itens, totalValor, empresaId, limparCarrinho } = useCarrinho();

  const [tela, setTela]                 = useState<Tela>("escolha");
  const [carregando, setCarregando]     = useState(false);
  const [carregandoDinheiro, setCarregandoDinheiro] = useState(false);
  const [simulando, setSimulando]       = useState(false);
  const [erro, setErro]                 = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl]   = useState<string | null>(null);
  const [tempoRestante, setTempoRestante] = useState(600);

  const pedidoRef   = useRef<{ id: string; senha: string } | null>(null);
  const pollingRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalRef    = useRef(totalValor);
  totalRef.current  = totalValor;
  const metodoRef   = useRef<"PIX" | "CARTAO" | "DINHEIRO">("PIX");
  // ID do reader quando o pagamento vai para maquininha física
  const readerIdRef = useRef<string | null>(null);

  useEffect(function() {
    return function() {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (timerRef.current)   clearInterval(timerRef.current);
    };
  }, []);

  function pararTudo() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (timerRef.current)   clearInterval(timerRef.current);
  }

  function pararPolling() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (timerRef.current)   clearInterval(timerRef.current);
  }

  // Regressiva exibida na tela; duracao em segundos
  function iniciarTimer(duracao = 600) {
    setTempoRestante(duracao);
    timerRef.current = setInterval(function() {
      setTempoRestante(function(prev) {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  async function confirmarPagamento(metodo: string) {
    if (!pedidoRef.current) return;
    var { id, senha } = pedidoRef.current;
    try {
      await fetch("/api/pagamentos/simular", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ pedidoId: id, valor: totalRef.current, metodo }),
      });
    } catch(e) { /* silencioso */ }
    limparCarrinho();
    router.push("/confirmacao?senha=" + encodeURIComponent(senha) + "&id=" + id);
  }

  async function simularAprovacao(metodo: string) {
    if (!pedidoRef.current || simulando) return;
    playClick();
    setSimulando(true);
    await confirmarPagamento(metodo);
  }

  /**
   * Polling de fallback: lê o status do Pagamento já gravado no banco
   * (fonte de verdade é o webhook do SumUp) — nunca consulta o SumUp direto.
   * Quando maquininha=true: usa timeout de 5 min.
   */
  function iniciarPolling(pedidoId: string, maquininha = false) {
    pararPolling();

    var duracaoSeg = maquininha ? 300 : 600;
    iniciarTimer(duracaoSeg);

    timeoutRef.current = setTimeout(function() {
      pararPolling();
      setErro("Tempo de pagamento expirado. Tente novamente.");
      setTela("escolha");
    }, maquininha ? TIMEOUT_MAQUININHA_MS : TIMEOUT_PIX_MS);

    var pollMs = maquininha ? POLL_CARTAO_MS : (metodoRef.current === "CARTAO" ? POLL_CARTAO_MS : POLL_STATUS_MS);

    pollingRef.current = setInterval(async function() {
      try {
        var statusRes  = await fetch("/api/pagamentos/status/" + pedidoId);
        var statusData = await statusRes.json();

        if (statusData.status === "APROVADO") {
          pararPolling();
          if (pedidoRef.current) {
            limparCarrinho();
            router.push(
              "/confirmacao?senha=" + encodeURIComponent(pedidoRef.current.senha) +
              "&id=" + pedidoRef.current.id
            );
          }
        } else if (
          statusData.status === "RECUSADO" ||
          statusData.status === "CANCELADO" ||
          statusData.status === "ESTORNADO"
        ) {
          pararPolling();
          setErro("Pagamento recusado ou expirado. Tente novamente.");
          setTela("escolha");
        }
      } catch(e) { /* manter polling em erros de rede */ }
    }, pollMs);
  }

  const criarPedido = useCallback(async function() {
    var clienteId: string | null = null;
    var mesaId:    string | null = null;
    try {
      clienteId = sessionStorage.getItem("clienteId");
      mesaId    = sessionStorage.getItem("mesaId");
    } catch(e) {}

    var res = await fetch("/api/pedidos", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        empresaId,
        clienteId: clienteId ?? undefined,
        mesaId:    mesaId    ?? undefined,
        itens: itens.map(function(item) {
          return {
            produtoId:  item.produtoId,
            quantidade: item.quantidade,
            precoUnit:  item.preco,
            observacao: item.observacao,
            adicionais: item.adicionais.map(function(a) {
              return { adicionalId: a.adicionalId, preco: a.preco };
            }),
          };
        }),
      }),
    });
    var dados = await res.json();
    if (!dados.ok) throw new Error(dados.error ?? "Erro ao criar pedido");
    return dados.data as { id: string; senha: string };
  }, [empresaId, itens]);

  const selecionarMetodo = useCallback(async function(metodo: "PIX" | "CARTAO") {
    if (carregando || itens.length === 0) return;
    playClick();
    setCarregando(true);
    setErro(null);
    metodoRef.current = metodo;

    try {
      var pedido = await criarPedido();
      pedidoRef.current = pedido;

      if (DEMO) {
        setTela(metodo === "PIX" ? "pix" : "cartao");
        setCarregando(false);
        return;
      }

      var cobrancaRes = await fetch("/api/pagamentos/sumup/criar", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          pedidoId:   pedido.id,
          metodo:     metodo,
          descricao:  "Coffee & Beats – " + pedido.senha,
          referencia: "CB-" + pedido.senha + "-" + Date.now(),
        }),
      });
      var cobranca = await cobrancaRes.json();
      if (!cobranca.ok) throw new Error(cobranca.error ?? "Erro ao criar cobrança");

      if (cobranca.data.metodo === "MAQUININHA") {
        // Maquininha física online: totem exibe tela de aguardo
        readerIdRef.current = cobranca.data.readerId as string;
        setTela("maquininha");
        setCarregando(false);
        iniciarPolling(pedido.id, true);
      } else {
        // Fallback web: comportamento anterior (QR PIX ou animação cartão)
        if (metodo === "CARTAO") iniciarPagamentoNFC(totalValor);
        if (metodo === "PIX")    setCheckoutUrl(cobranca.data.checkoutUrl as string);
        setTela(metodo === "PIX" ? "pix" : "cartao");
        setCarregando(false);
        iniciarPolling(pedido.id, false);
      }
    } catch(err) {
      setErro(err instanceof Error ? err.message : "Erro ao iniciar pagamento");
      setCarregando(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, itens, totalValor, criarPedido]);

  // Dinheiro: cria pedido + registra e vai direto para confirmação (sem SumUp)
  const selecionarDinheiro = useCallback(async function() {
    if (carregandoDinheiro) return;
    if (itens.length === 0) { setErro("Carrinho vazio. Adicione itens antes de pagar."); return; }
    playClick();
    setCarregandoDinheiro(true);
    setErro(null);
    try {
      var pedido = await criarPedido();
      pedidoRef.current = pedido;

      const res = await fetch("/api/pagamentos/dinheiro", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ pedidoId: pedido.id, valor: totalValor }),
      });
      const dados = await res.json().catch(function() { return null; });
      if (dados && !dados.ok) {
        throw new Error(dados.error ?? "Erro ao registrar pagamento em dinheiro");
      }

      limparCarrinho();
      router.push("/confirmacao?senha=" + encodeURIComponent(pedido.senha) + "&id=" + pedido.id);
    } catch(err) {
      setErro(err instanceof Error ? err.message : "Erro ao processar pagamento em dinheiro");
      setCarregandoDinheiro(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregandoDinheiro, itens, totalValor, criarPedido]);

  function voltarEscolha() {
    pararTudo();
    readerIdRef.current = null;
    setTela("escolha");
    setCheckoutUrl(null);
    setErro(null);
    setSimulando(false);
    setTempoRestante(600);
  }

  // ─── TELA MAQUININHA ─────────────────────────────────────────────────────────
  if (tela === "maquininha") {
    return (
      <div className="h-full flex flex-col animate-fadeIn">
        <HeaderTotem />
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
          <h1 className="font-sans font-extrabold text-3xl text-cb-marrom">
            Pagamento na Maquininha
          </h1>
          <p className="text-cb-marrom/60 text-lg">
            Total: <span className="text-cb-amber font-extrabold">{formatarMoeda(totalValor)}</span>
          </p>

          <div className="flex flex-col items-center gap-6 bg-white rounded-3xl p-10 shadow-sm">
            {/* Ícone animado */}
            <div className="relative w-28 h-28 flex items-center justify-center">
              <span className="text-7xl">🖥️</span>
              <span className="absolute -bottom-1 -right-1 text-3xl animate-bounce">💳</span>
            </div>

            <p className="font-extrabold text-cb-marrom text-2xl text-center">
              Conclua o pagamento na maquininha
            </p>
            <p className="text-cb-marrom/50 text-sm text-center">
              Aproxime o cartão, insira ou escaneie o QR PIX
            </p>

            {/* Spinner */}
            <div className="flex items-center gap-3 text-green-600 text-sm">
              <span className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              <span>Aguardando confirmação...</span>
            </div>

            {/* Contador regressivo */}
            <div className="flex items-center gap-2 text-cb-marrom/70">
              <span className="text-sm">Expira em:</span>
              <span className={"font-mono font-bold text-lg " + (tempoRestante < 60 ? "text-red-500" : "text-cb-marrom")}>
                {formatarTempo(tempoRestante)}
              </span>
            </div>
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
            ← Cancelar e escolher outra forma
          </button>
        </div>
      </div>
    );
  }

  // ─── TELA PIX ────────────────────────────────────────────────────────────────
  if (tela === "pix") {
    return (
      <div className="h-full flex flex-col animate-fadeIn">
        <HeaderTotem />
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
          <h1 className="font-sans font-extrabold text-3xl text-cb-marrom">Pagamento via PIX</h1>
          <p className="text-cb-marrom/60 text-lg">
            Total: <span className="text-cb-amber font-extrabold">{formatarMoeda(totalValor)}</span>
          </p>

          <div className="flex flex-col items-center gap-5 bg-white rounded-3xl p-8 shadow-sm">
            {DEMO ? (
              <>
                <p className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                  🧪 MODO SIMULAÇÃO
                </p>
                <QRFakeDemo />
                <p className="text-cb-marrom/50 text-sm">QR Code de demonstração</p>
                <button
                  onClick={function() { simularAprovacao("PIX"); }}
                  disabled={simulando}
                  className="w-full bg-green-600 text-white font-extrabold text-lg py-4 px-8
                             rounded-2xl touch-manipulation btn-totem disabled:opacity-60
                             hover:bg-green-700 transition-colors"
                >
                  {simulando ? "Processando..." : "✅ Simular PIX Aprovado"}
                </button>
              </>
            ) : checkoutUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={"https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=" + encodeURIComponent(checkoutUrl)}
                  alt="QR Code PIX"
                  width={200}
                  height={200}
                  className="rounded-lg"
                />
                <p className="text-cb-marrom/50 text-sm">Escaneie com o app do banco</p>
                <div className="flex items-center gap-2 text-cb-marrom/70">
                  <span className="text-sm">Expira em:</span>
                  <span className={"font-mono font-bold text-lg " + (tempoRestante < 60 ? "text-red-500" : "text-cb-marrom")}>
                    {formatarTempo(tempoRestante)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-green-600 text-sm animate-pulse">
                  <span className="text-lg">⟳</span>
                  <span>Verificando pagamento...</span>
                </div>
              </>
            ) : (
              <div className="w-48 h-48 bg-cb-marrom/10 rounded-xl flex items-center justify-center">
                <span className="text-cb-marrom/40 text-sm animate-pulse">Gerando QR Code...</span>
              </div>
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

  // ─── TELA CARTÃO (fallback web) ───────────────────────────────────────────────
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
            {DEMO ? (
              <>
                <p className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                  🧪 MODO SIMULAÇÃO
                </p>
                <span className="text-8xl">💳</span>
                <p className="font-extrabold text-cb-marrom text-2xl text-center">
                  Maquininha de teste
                </p>
                <button
                  onClick={function() { simularAprovacao("CARTAO"); }}
                  disabled={simulando}
                  className="w-full bg-green-600 text-white font-extrabold text-lg py-4 px-8
                             rounded-2xl touch-manipulation btn-totem disabled:opacity-60
                             hover:bg-green-700 transition-colors"
                >
                  {simulando ? "Processando..." : "✅ Simular Cartão Aprovado"}
                </button>
              </>
            ) : (
              <>
                <span className="text-8xl animate-bounce">💳</span>
                <p className="font-extrabold text-cb-marrom text-2xl text-center">
                  Aproxime ou insira seu cartão
                </p>
                <p className="text-cb-marrom/50 text-sm text-center">
                  Aceita débito, crédito e NFC
                </p>
                <div className="flex items-center gap-2 text-green-600 text-sm animate-pulse">
                  <span className="text-lg">⟳</span>
                  <span>Aguardando leitura do cartão...</span>
                </div>
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

  // ─── TELA ESCOLHA ────────────────────────────────────────────────────────────
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
          {DEMO && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded-full inline-block mt-2">
              🧪 Modo simulação ativo
            </p>
          )}
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-300 rounded-2xl px-6 py-4 text-red-600 text-base">
            {erro}
          </div>
        )}

        <div className="grid grid-cols-2 gap-5 w-full max-w-xl">
          {/* PIX */}
          <button
            onClick={function() { selecionarMetodo("PIX"); }}
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
            onClick={function() { selecionarMetodo("CARTAO"); }}
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

          {/* Dinheiro — imprime imediatamente, paga no balcão */}
          <button
            onClick={selecionarDinheiro}
            className={"flex flex-col items-center gap-3 bg-white border-2 rounded-2xl p-6 min-h-[130px] touch-manipulation btn-totem hover:border-cb-amber hover:bg-cb-bege/50 transition-colors " + (carregandoDinheiro ? "border-cb-amber opacity-70 cursor-wait" : "border-cb-marrom/20")}
          >
            <span className="text-4xl">💵</span>
            <span className="font-sans font-extrabold text-cb-marrom">
              {carregandoDinheiro ? "Processando..." : "Dinheiro"}
            </span>
            <span className="text-xs text-cb-marrom/60">Pagar no balcão</span>
          </button>

          {/* Placeholder para manter grid simétrico */}
          <div />
        </div>

        {carregando && (
          <p className="text-cb-marrom/50 text-sm animate-pulse">Criando pedido...</p>
        )}
      </div>
    </div>
  );
}
