"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { playClick } from "@/lib/sounds";
import { useCarrinho } from "@/contexts/CarrinhoContext";
import HeaderTotem from "@/components/totem/HeaderTotem";
import { formatarMoeda } from "@/lib/utils";
import { useTotemMobile } from "@/contexts/TotemModoContext";
import { printCupom } from "@/lib/sunmi-print";
import dynamic from "next/dynamic";
import { QRCodeSVG } from "qrcode.react";
import { gerarPixEstatico, pixEstaticoVisivel } from "@/lib/pix-estatico";
import { DIVISAO_STORAGE } from "@/lib/dividir-conta/domain";
import { encerrarAtendimentoDivisao, DIVISAO_TESTE_ISOLADA } from "@/lib/dividir-conta/client";

const DividirConta = dynamic(() => import("@/components/totem/DividirConta"), {
  loading: () => <p className="p-6 text-center">Carregando acompanhamento da conta…</p>,
});

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

// Nenhuma espera de rede é infinita: aborta e deixa a tela tratar o erro
async function fetchTimeout(url: string, init: RequestInit = {}, ms = 15000): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(function() { ctl.abort(); }, ms);
  try { return await fetch(url, { ...init, signal: ctl.signal }); }
  finally { clearTimeout(t); }
}

// QR Pix dinâmico do Mercado Pago é o principal (confirma sozinho pelo webhook/polling).
// O estático (chave CNPJ) vira reserva automática: aparece se o dinâmico falhar ou demorar > 10 s.
const PIX_DINAMICO_ATIVO = true;

async function copiarTexto(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* WebView sem clipboard API */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = texto; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

// Confirmação dupla do atendente antes de liberar o pedido pago na maquininha (ou por Pix)
function ModalConfirmacaoManual({ onConfirmar, onFechar, pix = false }: {
  onConfirmar: (semConciliacao: boolean) => Promise<string | null>; // texto = aviso que exige nova confirmação
  onFechar: () => void;
  pix?: boolean;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function confirmar() {
    if (enviando) return;
    playClick();
    setEnviando(true);
    setErroModal(null);
    try {
      var pendente = await onConfirmar(aviso !== null);
      if (pendente) { setAviso(pendente); setEnviando(false); }
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
          {pix ? "Confirme que o Pix da chave CNPJ caiu na conta antes de liberar o pedido." : "Confirme que o cliente realizou o pagamento na maquininha antes de liberar o pedido."}
        </p>

        {aviso && (
          <p role="alert" className="text-amber-800 bg-amber-50 border border-amber-300 rounded-xl p-3 text-base font-bold text-center">
            ⚠️ {aviso}
          </p>
        )}

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
            {enviando ? (pix ? "Liberando..." : "Conferindo...") : aviso ? "Vi \"Aprovado\" — liberar mesmo assim" : "✅ Sim, liberar pedido"}
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

// Card de método de pagamento no celular: linha horizontal, ícone + nome + detalhe
const CARD_MOBILE = "w-full flex flex-row items-center gap-4 px-5 py-4 min-h-[80px] text-[18px] ";

function formatarTempo(seg: number): string {
  var m = Math.floor(seg / 60);
  var s = seg % 60;
  return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
}

export default function Pagamento() {
  const router = useRouter();
  const { itens, totalValor, empresaId, limparCarrinho } = useCarrinho();
  const mobile = useTotemMobile(); // celular: cards de pagamento empilhados
  const [divisaoDisponivel, setDivisaoDisponivel] = useState(false);
  const [modoDivisao, setModoDivisao] = useState(false);
  // Divisão cancelada com parcela já paga: mostra o saldo restante ao voltar à escolha de pagamento
  const [divisaoParcial, setDivisaoParcial] = useState<{ pago: number; saldo: number } | null>(null);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DIVISAO_STORAGE);
      if (saved && JSON.parse(saved).id === DIVISAO_TESTE_ISOLADA) {
        encerrarAtendimentoDivisao(sessionStorage);
        limparCarrinho();
        router.replace("/cardapio");
        return;
      }
      if (saved) setModoDivisao(true);
    } catch { /* creation requires storage */ }
    fetch("/api/pagamentos/dividir/config", { cache: "no-store" }).then(r => r.json()).then(d => setDivisaoDisponivel(d.enabled === true)).catch(() => {});
  }, []);

  const [tela, setTela]                 = useState<Tela>("escolha");
  const [carregando, setCarregando]     = useState(false);
  const [carregandoDinheiro, setCarregandoDinheiro] = useState(false);
  const [simulando, setSimulando]       = useState(false);
  const [erro, setErro]                 = useState<string | null>(null);
  const [tempoRestante, setTempoRestante] = useState(600);
  // Cobrança SumUp não pôde ser criada: cliente paga direto na maquininha
  const [modalManual, setModalManual]   = useState(false);
  const [cancelando, setCancelando]     = useState(false);
  // Pix estático (chave CNPJ): código exibido na tela, "copiado" e se o modal é do Pix
  const [pixPayload, setPixPayload]     = useState<string | null>(null);
  const [pixCopiado, setPixCopiado]     = useState(false);
  const [modalPix, setModalPix]         = useState(false);
  // QR Pix dinâmico (Orders API): estado exibido no painel
  const [pixDin, setPixDin] = useState<{ estado: "gerando" | "pronto" | "erro"; qrData?: string; desde: number; erro?: string }>({ estado: "gerando", desde: 0 });
  const pixRefTotem = useRef<{ pedidoId: string; referencia: string; descricao: string } | null>(null);
  const [dinCopiado, setDinCopiado] = useState(false);
  const pixManualRef = useRef(false);

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
      var res   = await fetchTimeout("/api/pagamentos/cancelar/" + id, { method: "POST" }, 15000);
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
  async function confirmarManualmente(semConciliacao: boolean): Promise<string | null> {
    if (!pedidoRef.current) return null;
    var res   = await fetchTimeout("/api/pagamentos/confirmar-manual/" + pedidoRef.current.id, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ metodo: metodoRef.current === "PIX" ? "PIX" : "CARTAO", ...(pixManualRef.current ? { origem: "PIX_CNPJ" } : { semConciliacao: semConciliacao }) }),
    }, 25000);
    var dados = await res.json();
    if (dados.precisaConfirmar) return dados.error as string;
    if (!dados.ok) throw new Error(dados.error ?? "Erro ao confirmar pagamento");

    pararPolling();
    setModalManual(false);
    setModalPix(false);
    finalizar(metodoRef.current);
    return null;
  }

  const criarPedido = useCallback(async function(status?: "AGUARDANDO_PAGAMENTO") {
    var clienteId: string | null = null;
    var mesaId:    string | null = null;
    try {
      clienteId = sessionStorage.getItem("clienteId");
      mesaId    = sessionStorage.getItem("mesaId");
    } catch(e) {}

    var res = await fetchTimeout("/api/pedidos", {
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
    }, 15000);
    var dados = await res.json();
    if (!dados.ok) throw new Error(dados.error ?? "Erro ao criar pedido");
    return dados.data as { id: string; senha: string };
  }, [empresaId, itens]);

  // QR dinâmico: sem depender da Point nem do Pagamento existir. Timeout de 15 s; falha nunca é silenciosa.
  async function gerarPixDinamico() {
    var ref = pixRefTotem.current;
    if (!ref) return;
    setPixDin({ estado: "gerando", desde: Date.now() });
    try {
      var res = await fetchTimeout("/api/pagamentos/mp/pix-qr", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ pedidoId: ref.pedidoId, valor: totalRef.current, referencia: ref.referencia, descricao: ref.descricao }),
      }, 15000);
      var d = await res.json();
      if (pixRefTotem.current !== ref) return; // saiu da tela
      if (!d.ok || !d.qrData) throw new Error(d.error ?? "Resposta sem QR");
      setPixDin({ estado: "pronto", qrData: d.qrData as string, desde: Date.now() });
    } catch(e) {
      if (pixRefTotem.current !== ref) return;
      console.warn("[Pagamento] QR Pix dinâmico falhou:", e instanceof Error ? e.message : e);
      setPixDin({ estado: "erro", desde: Date.now(), erro: e instanceof Error ? e.message : "erro" });
    }
  }

  const selecionarMetodo = useCallback(async function(metodo: "PIX" | "CARTAO") {
    try { if (sessionStorage.getItem(DIVISAO_STORAGE)) { setModoDivisao(true); return; } } catch { /* preserve integral flow when storage is unavailable */ }
    if (carregando || itens.length === 0) return;
    playClick();
    setCarregando(true);
    setErro(null);
    metodoRef.current = metodo;


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

      if (metodo === "PIX") {
        // QR Pix estático (chave CNPJ) aparece NA HORA, sem esperar a maquineta nem a API do MP.
        // A cobrança na Point segue em paralelo (alternativa para cartão).
        var refPix = "CB-" + pedido.senha + "-" + Date.now();
        try { setPixPayload(gerarPixEstatico({ valor: totalRef.current, referencia: refPix })); } catch(e) { setPixPayload(null); }
        setPixCopiado(false);
        setDinCopiado(false);
        pixRefTotem.current = { pedidoId: pedido.id, referencia: refPix, descricao: "Coffee & Beats – " + pedido.senha };
        void gerarPixDinamico();
        setTela("maquininha");
        setCarregando(false);
        iniciarPolling(pedido.id, false);

        // Valor oficial do banco (se responder, substitui o código local)
        fetchTimeout("/api/pagamentos/pix-estatico/" + pedido.id + "?ref=" + encodeURIComponent(refPix), {}, 8000)
          .then(function(r) { return r.json(); })
          .then(function(d) { if (d && d.ok && d.payload && pedidoRef.current && pedidoRef.current.id === pedido.id) setPixPayload(d.payload as string); })
          .catch(function() { /* mantém o código local */ });

        fetchTimeout("/api/pagamentos/mp/criar", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ pedidoId: pedido.id, metodo: metodo, descricao: "Coffee & Beats – " + pedido.senha, referencia: refPix }),
        }, 20000)
          .then(function(r) { return r.json(); })
          .then(function(c) { if (c && c.ok && c.data) readerIdRef.current = c.data.readerId as string; else console.warn("[Pagamento] Point não recebeu a cobrança:", c && c.error); })
          .catch(function(e) { console.warn("[Pagamento] Cobrança na Point não criada:", e instanceof Error ? e.message : e); });
        return;
      }

      // Cartão vai para a Point do Mercado Pago: o cliente escolhe débito/crédito na própria maquininha
      var cobrancaRes = await fetch("/api/pagamentos/mp/criar", {
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

      // Point recebeu a cobrança: totem exibe tela de aguardo
      readerIdRef.current = cobranca.data.readerId as string;
      setTela("maquininha");
      setCarregando(false);
      iniciarPolling(pedido.id, true);
    } catch(err) {
      // Sem cobrança na Point (aparelho offline, erro na API): o cliente paga direto na
      // maquininha e o atendente confirma manualmente. Polling segue ativo caso o
      // pagamento seja aprovado por outro caminho.
      console.warn("[Pagamento] Cobrança na Point não criada:", err instanceof Error ? err.message : err);
      setTela(metodo === "PIX" ? "pix" : "cartao");
      setCarregando(false);
      iniciarPolling(pedido.id, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, itens, totalValor, criarPedido]);

  // Dinheiro: cria pedido + registra e vai direto para confirmação (sem SumUp)
  const selecionarDinheiro = useCallback(async function() {
    try { if (sessionStorage.getItem(DIVISAO_STORAGE)) { setModoDivisao(true); return; } } catch { /* preserve integral flow when storage is unavailable */ }
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
  // A navegação é imediata (não espera backend nem Mercado Pago); o cancelamento roda em segundo plano
  // e, se o pagamento tiver sido aprovado nesse meio tempo, segue para a confirmação.
  function voltarEscolha(destino: "escolha" | "carrinho" = "escolha") {
    playClick();
    pararTudo();
    setModalManual(false);
    setModalPix(false);
    pixManualRef.current = false;

    var pedidoCancelado = pedidoRef.current;
    pedidoRef.current   = null;
    readerIdRef.current = null;
    setPixPayload(null);
    setPixCopiado(false);
    pixRefTotem.current = null;
    setPixDin({ estado: "gerando", desde: 0 });
    setErro(null);
    setSimulando(false);
    setTempoRestante(600);
    setCancelando(false);
    if (destino === "carrinho") router.push("/carrinho");
    else setTela("escolha");

    if (pedidoCancelado) {
      fetchTimeout("/api/pagamentos/cancelar/" + pedidoCancelado.id, { method: "POST" }, 15000)
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d && d.jaAprovado === true) { pedidoRef.current = pedidoCancelado; finalizar(metodoRef.current); }
        })
        .catch(function(e) { console.warn("[Pagamento] cancelamento em segundo plano falhou:", e instanceof Error ? e.message : e); });
    }
  }

  // Rodapé comum às telas de aguardo: confirmação manual do atendente (com confirmação dupla)
  // acima do cancelar, empilhados no fluxo normal da página (sem fixed/absolute)
  // Chamado como função (não <Componente />) para o modal não remontar a cada tick do timer
  function acoesAguardo() {
    return (
      <>
        <div className="flex flex-col gap-2 w-full max-w-md shrink-0">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={function() { playClick(); pixManualRef.current = false; setModalPix(false); setModalManual(true); }}
              className="w-full bg-cb-confirma text-white font-bold text-base py-3 px-6
                         rounded-2xl touch-manipulation btn-totem"
            >
              ✓ Já paguei na maquininha — confirmar pedido
            </button>
            <p className="text-xs text-cb-marrom/60 text-center">
              Use somente se a maquininha mostrou &quot;Aprovado&quot; mas o totem não atualizou.
            </p>
          </div>

          <button
            onClick={function() { voltarEscolha("escolha"); }}
            className="w-full border-2 border-cb-marrom/30 text-cb-marrom font-bold text-base py-3 px-6
                       rounded-2xl touch-manipulation btn-totem"
          >
            Cancelar pagamento
          </button>
          <button
            onClick={function() { voltarEscolha("carrinho"); }}
            className="w-full text-cb-marrom/70 underline font-bold text-base py-2 px-6 touch-manipulation"
          >
            Voltar ao carrinho
          </button>
        </div>

        {modalManual && (
          <ModalConfirmacaoManual
            pix={modalPix}
            onConfirmar={confirmarManualmente}
            onFechar={function() { setModalManual(false); setModalPix(false); pixManualRef.current = false; }}
          />
        )}
      </>
    );
  }

  // Painel do Pix estático (chave CNPJ): QR grande, valor, copia e cola e confirmação do atendente
  function painelPix() {
    var decorrido = pixDin.estado === "gerando" && pixDin.desde ? Date.now() - pixDin.desde : 0;
    var visivel = pixEstaticoVisivel({ ativo: PIX_DINAMICO_ATIVO, estado: pixDin.estado, decorridoMs: decorrido });
    var tamanhoQr = 280;
    var dinamico = !PIX_DINAMICO_ATIVO ? null : (
      <div className="w-full flex flex-col items-center gap-2 bg-white rounded-3xl p-4 shadow-sm">
        <p className="font-extrabold text-cb-marrom text-xl text-center">Pague com Pix</p>
        {pixDin.estado === "pronto" && pixDin.qrData && (
          <>
            <div className="bg-white p-1 rounded-xl border border-cb-marrom/10" style={{ width: "clamp(220px, 32vh, 280px)", height: "clamp(220px, 32vh, 280px)" }}>
              <QRCodeSVG value={pixDin.qrData} size={tamanhoQr} marginSize={2} level="M" style={{ width: "100%", height: "100%" }} />
            </div>
            <p className="text-cb-amber font-extrabold text-2xl leading-tight">{formatarMoeda(totalValor)}</p>
            <p className="text-cb-marrom font-bold text-base text-center">Escaneie com o app do seu banco</p>
            <button
              onClick={async function() {
                playClick();
                if (pixDin.qrData && await copiarTexto(pixDin.qrData)) { setDinCopiado(true); setTimeout(function() { setDinCopiado(false); }, 3000); }
              }}
              className="w-full border-2 border-cb-marrom/30 text-cb-marrom font-bold text-base py-2 px-6 rounded-2xl touch-manipulation btn-totem"
            >
              {dinCopiado ? "✓ Código copiado" : "Copiar código Pix"}
            </button>
            <p className="text-xs text-cb-marrom/60 text-center">O pedido é liberado automaticamente quando o pagamento for confirmado.</p>
          </>
        )}
        {pixDin.estado === "gerando" && (
          <div className="flex items-center gap-3 text-cb-marrom/60 text-sm py-10">
            <span className="w-4 h-4 border-2 border-cb-marrom/40 border-t-transparent rounded-full animate-spin" />
            <span>Gerando QR Pix…</span>
          </div>
        )}
        {pixDin.estado === "erro" && (
          <div className="flex flex-col items-center gap-3 py-4 w-full">
            <p className="font-bold text-red-600 text-center">Não foi possível gerar o QR Pix</p>
            <button
              onClick={function() { playClick(); void gerarPixDinamico(); }}
              className="w-full bg-cb-marrom text-white font-bold text-base py-3 px-6 rounded-2xl touch-manipulation btn-totem"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    );
    if (!visivel) return dinamico;
    var reserva = PIX_DINAMICO_ATIVO;
    return (
      <div className="w-full flex flex-col gap-3">
      {dinamico}
      <div className="w-full flex flex-col items-center gap-2 bg-white rounded-3xl p-4 shadow-sm">
        {reserva && <p className="text-xs font-bold text-amber-700 bg-amber-50 rounded-full px-3 py-1">Pix reserva (chave CNPJ)</p>}
        {!reserva && <p className="font-extrabold text-cb-marrom text-xl text-center">Pague com Pix</p>}
        {pixPayload ? (
          <div className="bg-white p-1 rounded-xl border border-cb-marrom/10" style={{ width: "clamp(220px, 32vh, 280px)", height: "clamp(220px, 32vh, 280px)" }}>
            <QRCodeSVG value={pixPayload} size={tamanhoQr} marginSize={2} level="M" style={{ width: "100%", height: "100%" }} />
          </div>
        ) : (
          <div className="flex items-center gap-3 text-cb-marrom/60 text-sm py-16">
            <span className="w-4 h-4 border-2 border-cb-marrom/40 border-t-transparent rounded-full animate-spin" />
            <span>Gerando QR Pix…</span>
          </div>
        )}
        <p className="text-cb-amber font-extrabold text-2xl leading-tight">{formatarMoeda(totalValor)}</p>
        <p className="text-cb-marrom font-bold text-base text-center">Escaneie com o app do seu banco</p>
        <button
          disabled={!pixPayload}
          onClick={async function() {
            playClick();
            if (pixPayload && await copiarTexto(pixPayload)) { setPixCopiado(true); setTimeout(function() { setPixCopiado(false); }, 3000); }
          }}
          className="w-full border-2 border-cb-marrom/30 text-cb-marrom font-bold text-base py-2 px-6 rounded-2xl touch-manipulation btn-totem disabled:opacity-50"
        >
          {pixCopiado ? "✓ Código copiado" : "Copiar código Pix"}
        </button>
        <p className="text-xs font-bold text-amber-800 bg-amber-50 rounded-xl px-3 py-1 text-center">
          Após pagar, mostre o comprovante ao atendente
        </p>
        <button
          onClick={function() { playClick(); pixManualRef.current = true; setModalPix(true); setModalManual(true); }}
          className="w-full bg-cb-confirma text-white font-bold text-base py-2 px-6 rounded-2xl touch-manipulation btn-totem"
        >
          Atendente: confirmar Pix recebido
        </button>
      </div>
      </div>
    );
  }

  // ─── TELA MAQUININHA ─────────────────────────────────────────────────────────
  if (tela === "maquininha") {
    var ehPix = metodoRef.current === "PIX";
    return (
      <div className="h-full flex flex-col animate-fadeIn">
        <HeaderTotem />
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3">
          <div className={"w-full mx-auto " + (ehPix && !mobile ? "max-w-5xl grid grid-cols-2 gap-6 items-start" : "max-w-xl flex flex-col items-center gap-3")}>
            {ehPix && mobile && painelPix()}

            <div className="flex flex-col items-center gap-3">
              <h1 className="font-sans font-extrabold text-2xl text-cb-marrom text-center">
                {ehPix ? "Pagamento Pix ou Maquininha" : "Pagamento na Maquininha"}
              </h1>
              <p className="text-cb-marrom/60 text-lg">
                Total: <span className="text-cb-amber font-extrabold">{formatarMoeda(totalValor)}</span>
              </p>

              <div className="flex flex-col items-center gap-2 bg-white rounded-3xl p-4 shadow-sm">
                {/* Ícone animado */}
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <span className="text-5xl">🖥️</span>
                  <span className="absolute -bottom-1 -right-1 text-2xl animate-bounce">💳</span>
                </div>

                <p className="font-extrabold text-cb-marrom text-xl text-center">
                  {ehPix ? "Ou pague com cartão na maquininha" : "Conclua o pagamento na maquininha"}
                </p>
                <p className="text-cb-marrom/50 text-sm text-center">
                  {ehPix ? "Aproxime ou insira o cartão (débito ou crédito)" : "Aproxime o cartão, insira ou escaneie o QR PIX"}
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

            {ehPix && !mobile && painelPix()}
          </div>
        </div>
      </div>
    );
  }

  // ─── TELA PIX ────────────────────────────────────────────────────────────────
  if (tela === "pix") {
    return (
      <div className="h-full flex flex-col animate-fadeIn">
        <HeaderTotem />
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-[safe_center] px-8 py-5 gap-4">
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
            ) : (
              // Sem cobrança na Point: paga direto na maquininha, atendente confirma
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
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-[safe_center] px-8 py-5 gap-4">
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

  if (modoDivisao) return <div className="h-full flex flex-col"><HeaderTotem mostrarVoltar={false} /><DividirConta itens={itens} total={totalValor} onVoltar={(parcial) => { setModoDivisao(false); setDivisaoParcial(parcial ?? null); }} onAtendimento={() => {
    let arquivo: Storage | undefined;
    try { arquivo = localStorage; } catch { /* administrative recovery remains available */ }
    encerrarAtendimentoDivisao(sessionStorage, arquivo);
    limparCarrinho();
    for (const key of ["clienteId", "clienteNome", "clienteWpp", "mesaId", "mesaSessionExpiry", "cupomId", "cupomDesconto"]) sessionStorage.removeItem(key);
    router.replace("/cardapio");
  }} onQuitada={async pedido => {
    const response = await fetch(`/api/pedidos/${pedido.id}`);
    const data = await response.json();
    if (!data.ok) throw new Error("Pedido indisponível");
    const cupom = { numeroPedido: pedido.senha, total: pedido.total, metodoPagamento: "DIVIDIDO", itens: data.data.itens.map((i: { produto: { nome: string }; quantidade: number; precoUnit: string }) => ({ nome: i.produto.nome, quantidade: i.quantidade, preco: Number(i.precoUnit) })) };
    printCupom({ ...cupom, via: "CLIENTE" }).catch(() => {});
    printCupom({ ...cupom, via: "COZINHA" }).catch(() => {});
    limparCarrinho();
    router.push(`/confirmacao?senha=${encodeURIComponent(pedido.senha)}&id=${pedido.id}`);
  }} /></div>;

  // ─── TELA ESCOLHA ────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col animate-fadeIn">
      <HeaderTotem />

      <div className={"flex-1 flex flex-col items-center overflow-y-auto " + (mobile ? "justify-start p-4 pt-8 gap-6" : "justify-center p-8 gap-8")}>
        <div className="text-center">
          <h1 className={"font-sans font-extrabold text-cb-marrom " + (mobile ? "text-2xl" : "text-4xl")}>Como deseja pagar?</h1>
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

        {divisaoParcial && (
          <div className="w-full max-w-xl bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col gap-3" role="status">
            <p className="text-cb-marrom text-sm">
              Divisão em andamento: já pago <strong>{formatarMoeda(divisaoParcial.pago / 100)}</strong> · saldo restante <strong>{formatarMoeda(divisaoParcial.saldo / 100)}</strong>
            </p>
            <button onClick={function() { playClick(); setDivisaoParcial(null); setModoDivisao(true); }} className="w-full bg-cb-marrom text-white font-bold py-3 rounded-xl touch-manipulation">Continuar divisão</button>
          </div>
        )}

        <div className={mobile ? "flex flex-col gap-3 w-full" : "grid grid-cols-2 gap-5 w-full max-w-xl"}>
          <p className={"w-full text-left text-xs font-extrabold tracking-widest text-cb-marrom/60 " + (mobile ? "px-1" : "col-span-full")}>PAGAR INTEGRAL</p>
          {/* PIX */}
          <button
            onClick={function() { selecionarMetodo("PIX"); }}
            disabled={carregando}
            className={(mobile ? CARD_MOBILE : "flex flex-col items-center gap-3 p-6 min-h-[130px] ") +
                       "bg-white border-2 border-cb-marrom/20 rounded-2xl touch-manipulation btn-totem " +
                       "hover:border-cb-amber hover:bg-cb-bege/50 transition-colors disabled:opacity-60"}
          >
            <span className="text-4xl">📱</span>
            <span className={"font-sans font-extrabold text-cb-marrom " + (mobile ? "text-[18px] flex-1 text-left" : "")}>PIX</span>
            <span className={mobile ? "text-sm text-cb-marrom/60" : "text-xs text-cb-marrom/60"}>Instantâneo</span>
          </button>

          {/* Cartão */}
          <button
            onClick={function() { selecionarMetodo("CARTAO"); }}
            disabled={carregando}
            className={(mobile ? CARD_MOBILE : "flex flex-col items-center gap-3 p-6 min-h-[130px] ") +
                       "bg-white border-2 border-cb-marrom/20 rounded-2xl touch-manipulation btn-totem " +
                       "hover:border-cb-amber hover:bg-cb-bege/50 transition-colors disabled:opacity-60"}
          >
            <span className="text-4xl">💳</span>
            <span className={"font-sans font-extrabold text-cb-marrom " + (mobile ? "text-[18px] flex-1 text-left" : "")}>Cartão</span>
            <span className={mobile ? "text-sm text-cb-marrom/60" : "text-xs text-cb-marrom/60"}>Débito ou crédito</span>
          </button>

          {/* Dinheiro — imprime imediatamente, paga no balcão */}
          <button
            onClick={selecionarDinheiro}
            className={(mobile ? CARD_MOBILE : "flex flex-col items-center gap-3 p-6 min-h-[130px] ") + "bg-white border-2 rounded-2xl touch-manipulation btn-totem hover:border-cb-amber hover:bg-cb-bege/50 transition-colors " + (carregandoDinheiro ? "border-cb-amber opacity-70 cursor-wait" : "border-cb-marrom/20")}
          >
            <span className="text-4xl">💵</span>
            <span className={"font-sans font-extrabold text-cb-marrom " + (mobile ? "text-[18px] flex-1 text-left" : "")}>
              {carregandoDinheiro ? "Processando..." : "Dinheiro"}
            </span>
            <span className={mobile ? "text-sm text-cb-marrom/60" : "text-xs text-cb-marrom/60"}>Pagar no balcão</span>
          </button>

        </div>

        {divisaoDisponivel && (
          <button
            disabled={carregando || carregandoDinheiro || itens.length === 0 || totalValor < 0.02}
            onClick={() => setModoDivisao(true)}
            className={(mobile ? CARD_MOBILE : "flex flex-col items-center gap-3 p-6 min-h-[130px] w-full max-w-xl ") + "bg-white border-2 border-cb-amber/50 rounded-2xl touch-manipulation btn-totem disabled:opacity-50"}
          >
            <span className="text-4xl">👥</span>
            <span className="font-bold">DIVIDIR CONTA</span>
            <span className="text-xs">Partes iguais ou valores personalizados</span>
          </button>
        )}

        {carregando && (
          <p className="text-cb-marrom/50 text-sm animate-pulse">Criando pedido...</p>
        )}
      </div>
    </div>
  );
}
