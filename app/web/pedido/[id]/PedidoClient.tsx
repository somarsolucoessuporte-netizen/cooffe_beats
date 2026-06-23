"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatarMoeda } from "@/lib/utils";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

const STEPS = [
  { status: "RECEBIDO",   icone: "📋", label: "Pedido recebido",        progresso: 12 },
  { status: "EM_PREPARO", icone: "☕", label: "Em preparo",             progresso: 40 },
  { status: "PRONTO",     icone: "🔔", label: "Pronto para retirada",   progresso: 75 },
  { status: "ENTREGUE",   icone: "✅", label: "Entregue",               progresso: 100 },
] as const;

type StatusKey = typeof STEPS[number]["status"] | "CANCELADO" | "COMANDA_ABERTA" | "AGUARDANDO_PAGAMENTO";

interface ItemPedido {
  id: string; quantidade: number; precoTotal: string;
  produto: { nome: string };
  adicionais: { adicional: { nome: string } }[];
}
interface Pedido {
  id: string; senha: string; status: StatusKey;
  total: string; criadoEm: string; itens: ItemPedido[];
}

// Beep suave via Web Audio API
function tocarBeep() {
  try {
    var ctx  = new AudioContext();
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.65);
  } catch { /* áudio não disponível */ }
}

export default function PedidoWebClient({ pedidoId }: { pedidoId: string }) {
  const [pedido,       setPedido]       = useState<Pedido | null>(null);
  const [status,       setStatus]       = useState<StatusKey>("RECEBIDO");
  const [carregando,   setCarregando]   = useState(true);
  const [erro,         setErro]         = useState("");
  const [posicaoFila,  setPosicaoFila]  = useState<number | null>(null);
  const [tempoEstim,   setTempoEstim]   = useState<number | null>(null);
  const [prontoAlerta, setProntoAlerta] = useState(false);

  // Guarda o status anterior para detectar transição → PRONTO
  var statusAnterior = useRef<StatusKey | null>(null);

  // Dispara alerta quando o status muda para PRONTO
  useEffect(function () {
    if (status === "PRONTO" && statusAnterior.current !== null && statusAnterior.current !== "PRONTO") {
      setProntoAlerta(true);
      tocarBeep();
      setTimeout(function () { setProntoAlerta(false); }, 8000);
    }
    statusAnterior.current = status;
  }, [status]);

  // Calcula posição na fila usando a API existente (sem auth, campo empresaId)
  async function calcularFila(meuPedido: Pedido, tempoMedio: number) {
    if (meuPedido.status === "PRONTO" || meuPedido.status === "ENTREGUE") {
      setPosicaoFila(null);
      setTempoEstim(null);
      return;
    }
    try {
      var [r1, r2] = await Promise.all([
        fetch(`/api/pedidos?empresaId=${EMPRESA_ID}&status=RECEBIDO`).then(function (r) { return r.json(); }),
        fetch(`/api/pedidos?empresaId=${EMPRESA_ID}&status=EM_PREPARO`).then(function (r) { return r.json(); }),
      ]);
      var todos = [...(Array.isArray(r1?.data) ? r1.data : []), ...(Array.isArray(r2?.data) ? r2.data : [])];
      var meuTempo = new Date(meuPedido.criadoEm).getTime();
      // Pedidos criados antes do meu que ainda estão na fila
      var antes = todos.filter(function (p: Pedido) {
        return p.id !== meuPedido.id && new Date(p.criadoEm).getTime() < meuTempo;
      });
      var pos = antes.length + 1;
      setPosicaoFila(pos);
      setTempoEstim(pos * tempoMedio);
    } catch { /* silencioso */ }
  }

  useEffect(function () {
    var tempoMedioLocal = 5;

    // Busca dados do pedido + configuração de tempo médio em paralelo
    Promise.all([
      fetch(`/api/pedidos/${pedidoId}`).then(function (r) { return r.json(); }),
      fetch("/api/web/config").then(function (r) { return r.json(); }),
    ]).then(function ([dp, dc]) {
      if (dp.ok) {
        setPedido(dp.data);
        setStatus(dp.data.status);
        statusAnterior.current = dp.data.status;
        if (dc.ok) tempoMedioLocal = dc.data.tempoMedioMinutos ?? 5;
        calcularFila(dp.data, tempoMedioLocal);
      } else {
        setErro("Pedido não encontrado.");
      }
    })
    .catch(function () { setErro("Erro ao carregar pedido."); })
    .finally(function () { setCarregando(false); });

    // Realtime — mesmo canal do KDS e totem (não cria novo canal)
    var channel = supabase
      .channel(`empresa-${EMPRESA_ID}`)
      .on("broadcast", { event: "pedido:atualizado" }, function (msg) {
        var payload = msg.payload as { id: string; status: StatusKey };
        if (payload.id === pedidoId) {
          setStatus(payload.status);
          // Recalcula fila quando status muda
          if (pedido) calcularFila({ ...pedido, status: payload.status }, tempoMedioLocal);
        }
      })
      .subscribe();

    return function () { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  var stepAtualIdx  = STEPS.findIndex(function (s) { return s.status === status; });
  var progressoPerc = STEPS[stepAtualIdx]?.progresso ?? (status === "CANCELADO" ? 0 : 100);

  if (carregando) {
    return (
      <div className="max-w-screen-sm mx-auto px-4 py-16 flex justify-center">
        <div className="w-8 h-8 border-2 border-cb-amber border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (erro || !pedido) {
    return (
      <div className="max-w-screen-sm mx-auto px-4 py-16 text-center">
        <p className="text-red-500 mb-4">{erro || "Pedido não encontrado."}</p>
        <Link href="/web/cardapio" className="text-cb-amber hover:underline">Ir para o cardápio</Link>
      </div>
    );
  }

  var cancelado = status === "CANCELADO";

  return (
    <div className="max-w-screen-sm mx-auto px-4 py-8">

      {/* ── Banner "PRONTO" ────────────────────────────────────────── */}
      {prontoAlerta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-green-500 text-white rounded-3xl px-8 py-6 text-center shadow-2xl
                          animate-bounce mx-4 max-w-sm pointer-events-auto">
            <p className="text-4xl mb-2">🎉</p>
            <p className="text-xl font-extrabold">Seu pedido está pronto!</p>
            <p className="text-sm mt-1 opacity-90">Retire no balcão.</p>
            <button
              onClick={function () { setProntoAlerta(false); }}
              className="mt-4 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-4 py-1.5 rounded-full transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ── Senha do pedido ────────────────────────────────────────── */}
      <div className={`rounded-3xl px-8 py-6 text-center mb-6 transition-all duration-500 ${
        status === "PRONTO"
          ? "bg-green-500 shadow-green-200 shadow-lg"
          : "bg-cb-marrom"
      }`}>
        <p className="text-white/60 text-sm mb-1">Seu número de pedido</p>
        <p className="font-mono text-5xl font-extrabold tracking-widest text-white">{pedido.senha}</p>
        <p className="text-white/40 text-xs mt-2">
          {new Date(pedido.criadoEm).toLocaleString("pt-BR")}
        </p>
      </div>

      {/* ── Barra de progresso horizontal animada ─────────────────── */}
      {!cancelado && (
        <div className="bg-white border border-cb-marrom/10 rounded-2xl p-5 mb-4 shadow-sm">
          {/* Labels das 4 etapas */}
          <div className="flex justify-between mb-2">
            {STEPS.map(function (step, idx) {
              var concluido = stepAtualIdx > idx;
              var atual     = stepAtualIdx === idx;
              return (
                <div key={step.status} className="flex flex-col items-center gap-1" style={{ width: "25%" }}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                    concluido ? "bg-green-500 text-white" :
                    atual     ? "bg-cb-amber text-white ring-4 ring-cb-amber/20" :
                                "bg-cb-marrom/10 text-cb-marrom/30"
                  }`}>
                    {concluido ? "✓" : step.icone}
                  </div>
                  <span className={`text-xs text-center leading-tight transition-colors ${
                    atual ? "text-cb-marrom font-bold" :
                    concluido ? "text-green-600 font-medium" :
                                "text-cb-marrom/30"
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Barra de progresso */}
          <div className="relative mt-1 mb-4">
            {/* Fundo */}
            <div className="w-full h-2 bg-cb-marrom/10 rounded-full overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-1000 ease-out ${
                  status === "PRONTO" || status === "ENTREGUE" ? "bg-green-500" : "bg-cb-amber"
                }`}
                style={{ width: `${progressoPerc}%` }}
              />
            </div>
          </div>

          {/* Posição na fila + tempo estimado */}
          {posicaoFila !== null && status !== "PRONTO" && status !== "ENTREGUE" && (
            <div className="flex gap-4 justify-center flex-wrap mt-2">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-cb-marrom">{posicaoFila}°</p>
                <p className="text-xs text-cb-marrom/50">na fila</p>
              </div>
              {tempoEstim !== null && (
                <div className="text-center">
                  <p className="text-2xl font-extrabold text-cb-amber">~{tempoEstim}min</p>
                  <p className="text-xs text-cb-marrom/50">estimado</p>
                </div>
              )}
            </div>
          )}

          {/* Mensagem de destaque quando PRONTO */}
          {status === "PRONTO" && (
            <div className="text-center mt-2">
              <p className="text-green-600 font-extrabold text-lg animate-pulse">
                🔔 Retire no balcão!
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Cancelado ──────────────────────────────────────────────── */}
      {cancelado && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-4 text-center">
          <p className="text-red-600 font-bold">Pedido cancelado</p>
          <p className="text-red-400 text-sm mt-1">Entre em contato com o atendimento.</p>
        </div>
      )}

      {/* ── Itens do pedido ────────────────────────────────────────── */}
      <div className="bg-white border border-cb-marrom/10 rounded-2xl p-5 mb-4 shadow-sm">
        <p className="text-xs font-bold text-cb-marrom/40 uppercase tracking-widest mb-3">Itens</p>
        <div className="flex flex-col gap-2.5">
          {pedido.itens.map(function (item) {
            return (
              <div key={item.id} className="flex justify-between items-start text-sm">
                <div>
                  <span className="font-semibold text-cb-marrom">{item.quantidade}× {item.produto.nome}</span>
                  {item.adicionais.length > 0 && (
                    <p className="text-cb-marrom/40 text-xs">
                      + {item.adicionais.map(function (a) { return a.adicional.nome; }).join(", ")}
                    </p>
                  )}
                </div>
                <span className="text-cb-marrom/70 ml-2 shrink-0">{formatarMoeda(Number(item.precoTotal))}</span>
              </div>
            );
          })}
          <div className="border-t border-cb-marrom/10 pt-2.5 flex justify-between font-extrabold text-cb-marrom">
            <span>Total</span>
            <span className="text-cb-amber">{formatarMoeda(Number(pedido.total))}</span>
          </div>
        </div>
      </div>

      {/* ── Ações ──────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <Link href="/web/cardapio"
          className="flex-1 text-center border-2 border-cb-marrom text-cb-marrom font-bold py-3 rounded-2xl hover:bg-cb-bege transition-colors text-sm">
          Novo pedido
        </Link>
        <Link href="/web/conta"
          className="flex-1 text-center bg-cb-amber text-white font-bold py-3 rounded-2xl hover:bg-cb-amber/90 transition-colors text-sm">
          Meus pedidos
        </Link>
      </div>
    </div>
  );
}
