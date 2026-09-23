"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { playClick } from "@/lib/sounds";
import { useCarrinho } from "@/contexts/CarrinhoContext";
import HeaderTotem from "@/components/totem/HeaderTotem";
import { formatarMoeda } from "@/lib/utils";
import { iniciarPagamentoNFC } from "@/lib/sunmi";
import { printCupom } from "@/lib/sunmi-print";

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

// Confirmação dupla do atendente antes de liberar o pedido pago na maquininha
function ModalConfirmacaoManual({ onConfirmar, onFechar }: {
  onConfirmar: () => Promise<void>;
  onFechar: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);

  async function confirmar() {
    if (enviando) return;
    playClick();
    setEnviando(true);
    setErroModal(null);
    try {
      await onConfirmar();
    } catch(err) {
      setErroModal(err instanceof Error ? err.message : "Erro ao confirmar pagamento");
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={enviando ? undefined : onFechar}>
      <div
        className="bg-white rounded-2xl p-8 w-full max-w-md flex flex-col gap-4 shadow-xl"
        onClick={function(e) { e.stopPropagation(); }}
      >
        <p className="font-extrabold text-cb-marrom text-2xl text-center">Pagamento recebido?</p>
        <p className="text-cb-marrom/70 text-base text-center">
          Confirme que o cliente realizou o pagamento na maquininha antes de liberar o pedido.
        </p>

        {erroModal && (
          <p className="text-red-600 text-sm text-center">{erroModal}</p>
        )}

        <div className="flex flex-col gap-3 mt-2">
          <button
            onClick={confirmar}
            disabled={enviando}
            className="h-14 rounded-xl bg-cb-confirma text-white font-bold text-lg
                       touch-manipulation active:scale-95 disabled:opacity-60
                       flex items-center justify-center gap-2"
          >
            {enviando && (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {enviando ? "Liberando..." : "✅ Sim, liberar pedido"}
          </button>
          <button
            onClick={function() { playClick(); onFechar(); }}
            disabled={enviando}
            className="h-14 rounded-xl bg-transparent border-2 border-gray-300 text-cb-marrom font-bold text-lg
                       touch-manipulation active:scale-95 disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
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
  // Cobrança SumUp não pôde ser criada: cliente paga direto na maquininha
  const [semCobranca, setSemCobranca]   = useState(false);
  const [modalManual, setModalManual]   = useState(false);
  const [cancelando, setCancelando]     = useState(false);

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

  // Pagamento aprovado (webhook, confirmação do atendente ou simulação): imprime
  // comprovante + comanda e segue para a confirmação com a senha
  function finalizar(metodo: string) {
    if (!pedidoRef.current) return;
    var { id, senha } = pedidoRef.current;
    var nomeCliente: string | undefined;
    try { nomeCliente = sessionStorage.getItem("clienteNome") ?? undefined; } catch(e) {}

    var itensCupom = itens.map(function(item) {
      var adds = item.adicionais.map(function(a) { return a.nome; });
      return {
        nome:       adds.length > 0 ? item.nome + " + " + adds.join(", ") : item.nome,
        quantidade: item.quantidade,
        preco:      item.preco + item.adicionais.reduce(function(s, a) { return s + a.preco; }, 0),
        observacao: item.observacao ?? undefined,
      };
    });
    var base = { numeroPedido: senha, itens: itensCupom, total: totalRef.current, nomeCliente, metodoPagamento: metodo };
    printCupom({ ...base, via: "CLIENTE" }).catch(function() {});
    printCupom({ ...base, via: "COZINHA" }).catch(function() {});

    limparCarrinho();
    router.push("/confirmacao?senha=" + encodeURIComponent(senha) + "&id=" + id);
  }

  // Pedido PIX/cartão que não foi pago (desistência, expiração, recusa) — sai de
  // AGUARDANDO_PAGAMENTO para CANCELADO. Retorna true se o pagamento já tinha sido aprovado.
  async function cancelarPedidoPendente(): Promise<boolean> {
    if (!pedidoRef.current) return false;
    var id = pedidoRef.current.id;
    try {
      var res   = await fetch("/api/pagamentos/cancelar/" + id, { method: "POST" });
      var dados = await res.json();
      return dados.jaAprovado === true;
    } catch(e) {
      return false;
    }
  }

  async function confirmarPagamento(metodo: string) {
    if (!pedidoRef.current) return;
    var id = pedidoRef.current.id;
    try {
      await fetch("/api/pagamentos/simular", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ pedidoId: id, valor: totalRef.current, metodo }),
      });
    } catch(e) { /* silencioso */ }
    finalizar(metodo);
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
      setModalManual(false);
      cancelarPedidoPendente().then(function(jaAprovado) {
        if (jaAprovado) { finalizar(metodoRef.current); return; }
        pedidoRef.current = null;
        setErro("Tempo de pagamento expirado. Tente novamente.");
        setTela("escolha");
      });
    }, maquininha ? TIMEOUT_MAQUININHA_MS : TIMEOUT_PIX_MS);

    var pollMs = maquininha ? POLL_CARTAO_MS : (metodoRef.current === "CARTAO" ? POLL_CARTAO_MS : POLL_STATUS_MS);

    pollingRef.current = setInterval(async function() {
      try {
        var statusRes  = await fetch("/api/pagamentos/status/" + pedidoId);
        var statusData = await statusRes.json();

        if (statusData.status === "APROVADO") {
          pararPolling();
          setModalManual(false);
          finalizar(metodoRef.current);
        } else if (
          statusData.status === "RECUSADO" ||
          statusData.status === "CANCELADO" ||
          statusData.status === "ESTORNADO"
        ) {
          pararPolling();
          setModalManual(false);
          cancelarPedidoPendente();
          pedidoRef.current = null;
          setErro("Pagamento recusado ou expirado. Tente novamente.");
          setTela("escolha");
        }
      } catch(e) { /* manter polling em erros de rede */ }
    }, pollMs);
  }

  // Fallback manual: cliente pagou direto na maquininha e o atendente confirma
  // no modal de confirmação dupla. Lança erro com a mensagem da API para o modal.
  async function confirmarManualmente() {
    if (!pedidoRef.current) return;
    var res   = await fetch("/api/pagamentos/confirmar-manual/" + pedidoRef.current.id, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ metodo: metodoRef.current === "PIX" ? "PIX" : "CARTAO" }),
    });
    var dados = await res.json();
    if (!dados.ok) throw new Error(dados.error ?? "Erro ao confirmar pagamento");

    pararPolling();
    setModalManual(false);
    finalizar(metodoRef.current);
  }

  const criarPedido = useCallback(async function(status?: "AGUARDANDO_PAGAMENTO") {
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
        status,
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

    setSemCobranca(false);

    var pedido: { id: string; senha: string };
    try {
      // Só entra no KDS quando o pagamento for aprovado (webhook ou confirmação do atendente)
      pedido = await criarPedido("AGUARDANDO_PAGAMENTO");
      pedidoRef.current = pedido;
    } catch(err) {
      setErro(err instanceof Error ? err.message : "Erro ao criar pedido");
      setCarregando(false);
      return;
    }

    try {
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
      // Sem cobrança na SumUp (ex.: scope payments ainda não liberado): o cliente
      // paga direto na maquininha e o atendente confirma manualmente. Polling segue
      // ativo caso o pagamento seja aprovado por outro caminho.
      console.warn("[Pagamento] Cobrança SumUp não criada:", err instanceof Error ? err.message : err);
      setSemCobranca(true);
      setTela(metodo === "PIX" ? "pix" : "cartao");
      setCarregando(false);
      iniciarPolling(pedido.id, false);
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

  // "Cancelar pagamento": cancela o pedido pendente e volta para a escolha do método
  async function voltarEscolha() {
    if (cancelando) return;
    playClick();
    setCancelando(true);
    pararTudo();
    setModalManual(false);

    var jaAprovado = await cancelarPedidoPendente();
    if (jaAprovado) { finalizar(metodoRef.current); return; }

    pedidoRef.current   = null;
    readerIdRef.current = null;
    setTela("escolha");
    setCheckoutUrl(null);
    setSemCobranca(false);
    setErro(null);
    setSimulando(false);
    setTempoRestante(600);
    setCancelando(false);
  }

  // Rodapé comum às telas de aguardo: cancelar (esquerda) + confirmação manual
  // do atendente (canto inferior direito, discreta, com confirmação dupla)
  // Chamado como função (não <Componente />) para o modal não remontar a cada tick do timer
  function acoesAguardo() {
    return (
      <>
        <button
          onClick={voltarEscolha}
          disabled={cancelando}
          className="border-2 border-cb-marrom/30 text-cb-marrom font-bold text-base py-3 px-8
                     rounded-2xl touch-manipulation btn-totem disabled:opacity-60"
        >
          {cancelando ? "Cancelando..." : "Cancelar pagamento"}
        </button>

        <button
          onClick={function() { playClick(); setModalManual(true); }}
          className="fixed bottom-5 right-5 z-40 bg-cb-confirma text-white text-sm font-semibold
                     py-2.5 px-4 rounded-xl shadow-md touch-manipulation opacity-90 active:scale-95"
        >
          ✓ Confirmar pagamento recebido
        </button>

        {modalManual && (
          <ModalConfirmacaoManual
            onConfirmar={confirmarManualmente}
            onFechar={function() { setModalManual(false); }}
          />
        )}
      </>
    );
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

          {acoesAguardo()}
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
            ) : semCobranca ? (
              <>
                <span className="text-8xl">📱</span>
                <p className="font-extrabold text-cb-marrom text-2xl text-center">
                  Pague com PIX na maquininha
                </p>
                <div className="flex items-center gap-2 text-green-600 text-sm animate-pulse">
                  <span className="text-lg">⟳</span>
                  <span>Aguardando confirmação de pagamento...</span>
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

          {acoesAguardo()}
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

          {acoesAguardo()}
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
