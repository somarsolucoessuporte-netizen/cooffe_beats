"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatarMoeda } from "@/lib/utils";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

const STEPS = [
  { status: "RECEBIDO",   icone: "📋", label: "Pedido recebido" },
  { status: "EM_PREPARO", icone: "☕", label: "Em preparo" },
  { status: "PRONTO",     icone: "🔔", label: "Pronto para retirada" },
  { status: "ENTREGUE",   icone: "✅", label: "Entregue" },
] as const;

type StatusKey = typeof STEPS[number]["status"] | "CANCELADO" | "COMANDA_ABERTA" | "AGUARDANDO_PAGAMENTO";

interface ItemPedido {
  id:         string;
  quantidade: number;
  precoTotal: string;
  produto:    { nome: string };
  adicionais: { adicional: { nome: string } }[];
}

interface Pedido {
  id:         string;
  senha:      string;
  status:     StatusKey;
  total:      string;
  criadoEm:  string;
  itens:      ItemPedido[];
}

export default function PedidoWebClient({ pedidoId }: { pedidoId: string }) {
  const [pedido,     setPedido]     = useState<Pedido | null>(null);
  const [status,     setStatus]     = useState<StatusKey>("RECEBIDO");
  const [carregando, setCarregando] = useState(true);
  const [erro,       setErro]       = useState("");

  useEffect(function () {
    fetch(`/api/pedidos/${pedidoId}`)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) {
          setPedido(d.data);
          setStatus(d.data.status);
        } else {
          setErro("Pedido não encontrado.");
        }
      })
      .catch(function () { setErro("Erro ao carregar pedido."); })
      .finally(function () { setCarregando(false); });

    // Realtime — mesmo canal usado pelo KDS e totem
    var channel = supabase
      .channel(`empresa-${EMPRESA_ID}`)
      .on("broadcast", { event: "pedido:atualizado" }, function (msg) {
        var payload = msg.payload as { id: string; status: StatusKey };
        if (payload.id === pedidoId) setStatus(payload.status);
      })
      .subscribe();

    return function () { supabase.removeChannel(channel); };
  }, [pedidoId]);

  var stepAtualIdx = STEPS.findIndex(function (s) { return s.status === status; });

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

      {/* Senha do pedido */}
      <div className="bg-cb-marrom rounded-3xl px-8 py-6 text-center text-cb-bege mb-6">
        <p className="text-cb-bege/60 text-sm mb-1">Seu número de pedido</p>
        <p className="font-mono text-5xl font-extrabold tracking-widest">{pedido.senha}</p>
        <p className="text-cb-bege/50 text-xs mt-2">
          {new Date(pedido.criadoEm).toLocaleString("pt-BR")}
        </p>
      </div>

      {/* Stepper de status */}
      {!cancelado ? (
        <div className="bg-white border border-cb-marrom/10 rounded-2xl p-5 mb-4 shadow-sm">
          <p className="text-xs font-bold text-cb-marrom/40 uppercase tracking-widest mb-4">Status do pedido</p>
          <div className="flex flex-col gap-0">
            {STEPS.map(function (step, idx) {
              var concluido = stepAtualIdx > idx;
              var atual     = stepAtualIdx === idx;
              return (
                <div key={step.status} className="flex items-start gap-4">
                  {/* Linha vertical + círculo */}
                  <div className="flex flex-col items-center">
                    <div className={
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 transition-all " +
                      (concluido ? "bg-green-500 text-white" :
                       atual     ? "bg-cb-amber text-white ring-4 ring-cb-amber/20" :
                                   "bg-cb-marrom/10 text-cb-marrom/30")
                    }>
                      {concluido ? "✓" : step.icone}
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={
                        "w-0.5 h-6 mt-0.5 " +
                        (concluido ? "bg-green-500" : "bg-cb-marrom/10")
                      } />
                    )}
                  </div>
                  {/* Label */}
                  <div className="pt-1 pb-5">
                    <p className={
                      "text-sm font-semibold " +
                      (atual ? "text-cb-marrom" : concluido ? "text-green-600" : "text-cb-marrom/30")
                    }>
                      {step.label}
                    </p>
                    {atual && status === "PRONTO" && (
                      <p className="text-cb-amber text-xs font-bold mt-0.5 animate-pulse">
                        Retire no balcão!
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-4 text-center">
          <p className="text-red-600 font-bold">Pedido cancelado</p>
          <p className="text-red-400 text-sm mt-1">Entre em contato com o atendimento.</p>
        </div>
      )}

      {/* Itens do pedido */}
      <div className="bg-white border border-cb-marrom/10 rounded-2xl p-5 mb-4 shadow-sm">
        <p className="text-xs font-bold text-cb-marrom/40 uppercase tracking-widest mb-3">Itens</p>
        <div className="flex flex-col gap-2.5">
          {pedido.itens.map(function (item) {
            return (
              <div key={item.id} className="flex justify-between items-start text-sm">
                <div>
                  <span className="font-semibold text-cb-marrom">
                    {item.quantidade}× {item.produto.nome}
                  </span>
                  {item.adicionais.length > 0 && (
                    <p className="text-cb-marrom/40 text-xs">
                      + {item.adicionais.map(function (a) { return a.adicional.nome; }).join(", ")}
                    </p>
                  )}
                </div>
                <span className="text-cb-marrom/70 ml-2 shrink-0">
                  {formatarMoeda(Number(item.precoTotal))}
                </span>
              </div>
            );
          })}
          <div className="border-t border-cb-marrom/10 pt-2.5 flex justify-between font-extrabold text-cb-marrom">
            <span>Total</span>
            <span className="text-cb-amber">{formatarMoeda(Number(pedido.total))}</span>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex gap-3">
        <Link
          href="/web/cardapio"
          className="flex-1 text-center border-2 border-cb-marrom text-cb-marrom font-bold py-3
                     rounded-2xl hover:bg-cb-bege transition-colors text-sm"
        >
          Novo pedido
        </Link>
        <Link
          href="/web/conta"
          className="flex-1 text-center bg-cb-amber text-white font-bold py-3
                     rounded-2xl hover:bg-cb-amber/90 transition-colors text-sm"
        >
          Meus pedidos
        </Link>
      </div>
    </div>
  );
}
