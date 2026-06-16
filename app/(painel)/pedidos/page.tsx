"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { calcularTempoDecorrido, formatarMoeda } from "@/lib/utils";

interface ItemPedido {
  id: string;
  quantidade: number;
  produto: { nome: string };
  adicionais: Array<{ adicional: { nome: string } }>;
}

interface Pedido {
  id: string;
  senha: string;
  status: string;
  total: string;
  criadoEm: string;
  itens: ItemPedido[];
}

type StatusColuna = "RECEBIDO" | "EM_PREPARO" | "PRONTO" | "ENTREGUE";

const colunas: { status: StatusColuna; label: string; cor: string }[] = [
  { status: "RECEBIDO",   label: "Recebidos",  cor: "border-blue-500 bg-blue-500/5" },
  { status: "EM_PREPARO", label: "Em Preparo", cor: "border-yellow-500 bg-yellow-500/5" },
  { status: "PRONTO",     label: "Prontos",    cor: "border-green-500 bg-green-500/5" },
  { status: "ENTREGUE",   label: "Entregues",  cor: "border-zinc-600 bg-zinc-800/50" },
];

const proximoStatus: Record<string, StatusColuna | null> = {
  RECEBIDO:   "EM_PREPARO",
  EM_PREPARO: "PRONTO",
  PRONTO:     "ENTREGUE",
  ENTREGUE:   null,
};

type CaixaInfo = {
  id: string;
  abridoEm: string;
  valorAbertura: number;
  operador: string;
};

type CaixaResumo = {
  totalPedidos: number;
  totalVendas: number;
  totalPix: number;
  totalCartao: number;
  totalDinheiro: number;
  ticketMedio: number;
};

const R$ = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Pedidos() {
  const { data: session } = useSession();
  const empresaId = (session?.user as { empresaId?: string })?.empresaId ?? "";

  // --- Caixa ---
  const [caixaStatus, setCaixaStatus] = useState<"verificando" | "fechado" | "aberto">("verificando");
  const [caixaInfo,   setCaixaInfo]   = useState<CaixaInfo | null>(null);
  const [caixaResumo, setCaixaResumo] = useState<CaixaResumo | null>(null);
  const [modalAbertura,   setModalAbertura]   = useState(false);
  const [modalFechamento, setModalFechamento] = useState(false);
  const [valorAbertura, setValorAbertura] = useState("");
  const [obsFechamento, setObsFechamento] = useState("");
  const [abrindo,  setAbrindo]  = useState(false);
  const [fechando, setFechando] = useState(false);

  // --- Pedidos ---
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

  const verificarCaixa = useCallback(async () => {
    try {
      const res  = await fetch("/api/caixa/status");
      const data = await res.json();
      if (data.ok) {
        if (data.data.aberto) {
          setCaixaStatus("aberto");
          setCaixaInfo(data.data.caixa);
          setCaixaResumo(data.data.resumo);
        } else {
          setCaixaStatus("fechado");
          setModalAbertura(true);
        }
      }
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { verificarCaixa(); }, [verificarCaixa]);

  const buscarPedidos = useCallback(async () => {
    if (!empresaId) return;
    const res   = await fetch(`/api/pedidos?empresaId=${empresaId}`);
    const dados = await res.json();
    if (dados.ok) setPedidos(dados.data);
  }, [empresaId]);

  useEffect(() => { buscarPedidos(); }, [buscarPedidos]);

  useEffect(() => {
    if (!empresaId) return;
    const channel = supabase
      .channel(`empresa-${empresaId}`)
      .on("broadcast", { event: "pedido:novo" }, ({ payload }) => {
        setPedidos((prev) => [payload as Pedido, ...prev]);
      })
      .on("broadcast", { event: "pedido:atualizado" }, ({ payload }) => {
        const { id, status } = payload as { id: string; status: string };
        setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [empresaId]);

  const avancarStatus = useCallback(async (pedidoId: string, statusAtual: string) => {
    const proximo = proximoStatus[statusAtual];
    if (!proximo) return;
    await fetch(`/api/pedidos/${pedidoId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: proximo }),
    });
  }, []);

  const abrirCaixa = async () => {
    setAbrindo(true);
    try {
      const res  = await fetch("/api/caixa/abrir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valorAbertura: parseFloat(valorAbertura) || 0 }),
      });
      const data = await res.json();
      if (data.ok) {
        setModalAbertura(false);
        setValorAbertura("");
        await verificarCaixa();
      }
    } catch { /* silencioso */ }
    finally { setAbrindo(false); }
  };

  const fecharCaixa = async () => {
    setFechando(true);
    try {
      const res  = await fetch("/api/caixa/fechar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacao: obsFechamento }),
      });
      const data = await res.json();
      if (data.ok) {
        setCaixaStatus("fechado");
        setCaixaInfo(null);
        setCaixaResumo(null);
        setModalFechamento(false);
        setObsFechamento("");
        alert("Caixa fechado! Bom descanso ☕");
      }
    } catch { /* silencioso */ }
    finally { setFechando(false); }
  };

  const imprimirRelatorioDia = async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    try {
      const res = await fetch("/api/relatorios/dia?data=" + hoje);
      const d   = await res.json();
      if (!d.ok) return;
      const rel = d.data;
      const html = `<!DOCTYPE html><html><head>
<style>@page{size:80mm auto;margin:0}body{font-family:'Courier New',monospace;font-size:11px;width:80mm;padding:8px;margin:0}h1{text-align:center;font-size:14px;margin:4px 0}.linha{display:flex;justify-content:space-between;margin:2px 0}.sep{border-top:1px dashed #000;margin:6px 0}.bold{font-weight:bold}</style>
</head><body>
<h1>RELATÓRIO DO DIA</h1><h1>${rel.data}</h1>
<div class="sep"></div>
<div class="linha"><span>Pedidos:</span><span>${rel.totalPedidos}</span></div>
<div class="linha"><span>Cancelados:</span><span>${rel.cancelados}</span></div>
<div class="sep"></div>
<div class="linha bold"><span>TOTAL VENDAS:</span><span>${R$(rel.totalVendas)}</span></div>
<div class="linha"><span>PIX:</span><span>${R$(rel.totalPix)}</span></div>
<div class="linha"><span>Cartão:</span><span>${R$(rel.totalCartao)}</span></div>
<div class="linha"><span>Dinheiro:</span><span>${R$(rel.totalDinheiro)}</span></div>
<div class="sep"></div>
<div style="text-align:center;font-size:10px">${new Date().toLocaleString("pt-BR")}</div>
</body></html>`;
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
      document.body.appendChild(iframe);
      if (iframe.contentWindow) {
        iframe.contentWindow.document.open();
        iframe.contentWindow.document.write(html);
        iframe.contentWindow.document.close();
        setTimeout(function() {
          try { if (iframe.contentWindow) iframe.contentWindow.print(); } catch(e) {}
          setTimeout(function() { try { document.body.removeChild(iframe); } catch(e) {} }, 1000);
        }, 500);
      }
    } catch { /* silencioso */ }
  };

  const pedidosDaColuna = (status: string) => pedidos.filter((p) => p.status === status);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 py-6 border-b border-zinc-800">
        <h1 className="text-2xl font-bold text-zinc-100">Pedidos</h1>
        <p className="text-zinc-400 text-sm mt-1">Atualização em tempo real via Supabase Realtime</p>
      </div>

      {/* Banner — caixa aberto */}
      {caixaStatus === "aberto" && caixaInfo && caixaResumo && (
        <div className="bg-[#F6F0E5] border-b border-[#3B2415]/10 px-6 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-semibold text-[#3B2415]">Caixa aberto</span>
              <span className="text-xs text-[#3B2415]/50">
                desde {new Date(caixaInfo.abridoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-[#3B2415]/60">
                Pedidos: <strong className="text-[#3B2415]">{caixaResumo.totalPedidos}</strong>
              </span>
              <span className="text-[#3B2415]/60">
                Vendas: <strong className="text-[#C8853A]">{R$(caixaResumo.totalVendas)}</strong>
              </span>
              {caixaResumo.ticketMedio > 0 && (
                <span className="text-[#3B2415]/60">
                  Ticket médio: <strong className="text-[#3B2415]">{R$(caixaResumo.ticketMedio)}</strong>
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setModalFechamento(true)}
            className="text-sm font-semibold text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl transition-all border border-red-200"
          >
            🔒 Fechar Caixa
          </button>
        </div>
      )}

      {/* Banner — caixa fechado (aviso discreto) */}
      {caixaStatus === "fechado" && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between gap-4">
          <span className="text-amber-700 text-sm font-medium">
            ⚠️ Caixa não aberto — pedidos não serão vinculados a um caixa
          </span>
          <button
            onClick={() => setModalAbertura(true)}
            className="text-sm font-bold text-amber-700 hover:bg-amber-100 px-3 py-1 rounded-lg transition-all whitespace-nowrap"
          >
            Abrir Caixa
          </button>
        </div>
      )}

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-5 h-full min-w-max">
          {colunas.map((col) => (
            <div
              key={col.status}
              className={`flex flex-col w-72 rounded-2xl border-2 ${col.cor} overflow-hidden`}
            >
              <div className="px-4 py-3 border-b border-zinc-700 flex items-center justify-between">
                <span className="font-semibold text-zinc-200">{col.label}</span>
                <span className="bg-zinc-800 text-zinc-300 text-sm font-mono px-3 py-0.5 rounded-full">
                  {pedidosDaColuna(col.status).length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                {pedidosDaColuna(col.status).map((pedido) => (
                  <div
                    key={pedido.id}
                    className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-mono font-bold text-cb-amber text-lg">{pedido.senha}</span>
                      <span className="text-xs text-zinc-500">{calcularTempoDecorrido(pedido.criadoEm)}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {pedido.itens.slice(0, 3).map((item) => (
                        <p key={item.id} className="text-sm text-zinc-300">
                          {item.quantidade}x {item.produto.nome}
                        </p>
                      ))}
                      {pedido.itens.length > 3 && (
                        <p className="text-xs text-zinc-500">+{pedido.itens.length - 3} itens</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-cb-gold font-semibold">{formatarMoeda(pedido.total)}</span>
                      {proximoStatus[pedido.status] && (
                        <button
                          onClick={() => avancarStatus(pedido.id, pedido.status)}
                          className="text-xs bg-cb-amber text-cb-espresso font-bold px-3 py-1.5 rounded-full"
                        >
                          Avançar →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {pedidosDaColuna(col.status).length === 0 && (
                  <div className="flex-1 flex items-center justify-center py-8">
                    <p className="text-zinc-600 text-sm text-center">Nenhum pedido</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ====== MODAL DE ABERTURA ====== */}
      {modalAbertura && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Coffee & Beats" className="w-24 mx-auto mb-4 object-contain" />
              <h2 className="text-2xl font-extrabold text-[#3B2415]">Bom dia! ☕</h2>
              <p className="text-[#3B2415]/60 mt-1 capitalize">
                {new Date().toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-[#3B2415] mb-2">
                Valor de abertura (troco inicial)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3B2415] font-bold">
                  R$
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={valorAbertura}
                  onChange={(e) => setValorAbertura(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-12 pr-4 py-4 border-2 border-[#3B2415]/20 rounded-2xl
                             text-xl font-bold text-[#3B2415] focus:border-[#3B2415] focus:outline-none"
                />
              </div>
              <p className="text-xs text-[#3B2415]/40 mt-1">Digite 0 se não houver troco inicial</p>
            </div>

            <button
              onClick={abrirCaixa}
              disabled={abrindo}
              className="w-full bg-[#3B2415] text-[#F6F0E5] py-4 rounded-2xl font-extrabold
                         text-lg hover:bg-[#3B2415]/90 transition-all disabled:opacity-60"
            >
              {abrindo ? "Abrindo..." : "🔓 ABRIR CAIXA E COMEÇAR O DIA"}
            </button>
          </div>
        </div>
      )}

      {/* ====== MODAL DE FECHAMENTO ====== */}
      {modalFechamento && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full mx-4 my-8 shadow-2xl">
            <h2 className="text-2xl font-extrabold text-[#3B2415] mb-6 text-center">
              🔒 Fechar o Caixa?
            </h2>

            {caixaResumo && (
              <div className="bg-[#F6F0E5] rounded-2xl p-6 mb-6">
                <h3 className="font-bold text-[#3B2415] mb-4">Resumo do dia</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#3B2415]/70">Total de pedidos</span>
                    <strong className="text-[#3B2415]">{caixaResumo.totalPedidos}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#3B2415]/70">Faturamento total</span>
                    <strong className="text-[#C8853A] text-lg">{R$(caixaResumo.totalVendas)}</strong>
                  </div>
                  {caixaResumo.ticketMedio > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#3B2415]/70">Ticket médio</span>
                      <strong className="text-[#3B2415]">{R$(caixaResumo.ticketMedio)}</strong>
                    </div>
                  )}
                  <div className="border-t border-[#3B2415]/10 pt-2 mt-2 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#3B2415]/70">PIX</span>
                      <span>{R$(caixaResumo.totalPix)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#3B2415]/70">Cartão</span>
                      <span>{R$(caixaResumo.totalCartao)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[#3B2415]/70">Dinheiro</span>
                      <span>{R$(caixaResumo.totalDinheiro)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <textarea
              value={obsFechamento}
              onChange={(e) => setObsFechamento(e.target.value)}
              placeholder="Observação (opcional)..."
              className="w-full border-2 border-[#3B2415]/20 rounded-2xl p-4 text-sm mb-6
                         focus:border-[#3B2415] focus:outline-none resize-none"
              rows={2}
            />

            <div className="flex gap-3 mb-3">
              <button
                onClick={imprimirRelatorioDia}
                className="flex-1 border-2 border-[#3B2415] text-[#3B2415] py-3 rounded-2xl
                           font-bold hover:bg-[#F6F0E5] transition-all"
              >
                🖨️ Imprimir Relatório
              </button>
              <button
                onClick={fecharCaixa}
                disabled={fechando}
                className="flex-1 bg-red-600 text-white py-3 rounded-2xl font-bold
                           hover:bg-red-700 transition-all disabled:opacity-60"
              >
                {fechando ? "Fechando..." : "✅ Confirmar Fechamento"}
              </button>
            </div>

            <button
              onClick={() => setModalFechamento(false)}
              className="w-full text-[#3B2415]/50 text-sm hover:text-[#3B2415] transition-all py-2"
            >
              Cancelar — continuar o dia
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
