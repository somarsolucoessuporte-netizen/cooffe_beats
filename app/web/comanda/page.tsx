"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatarMoeda } from "@/lib/utils";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

type StatusComanda = "COMANDA_ABERTA" | "AGUARDANDO_PAGAMENTO" | "ENTREGUE" | "CANCELADO";

interface ItemComanda {
  id:         string;
  quantidade: number;
  precoTotal: string;
  observacao: string | null;
  produto:    { nome: string; fotoUrl: string | null };
  adicionais: { adicional: { nome: string } }[];
}

interface Comanda {
  id:     string;
  senha:  string;
  status: StatusComanda;
  total:  string;
  mesa:   { numero: number; nome: string | null } | null;
  itens:  ItemComanda[];
}

export default function WebComanda() {
  const [comanda,    setComanda]    = useState<Comanda | null>(null);
  const [status,     setStatus]     = useState<StatusComanda>("COMANDA_ABERTA");
  const [carregando, setCarregando] = useState(true);
  const [solicitando, setSolicitando] = useState(false);
  const [erro,       setErro]       = useState("");

  const buscarComanda = useCallback(async function () {
    try {
      var r = await fetch("/api/web/comanda");
      var d = await r.json();
      if (d.ok && d.data) {
        setComanda(d.data);
        setStatus(d.data.status);
      } else {
        setComanda(null);
      }
    } catch {
      setErro("Erro ao buscar comanda.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(function () {
    buscarComanda();

    var channel = supabase
      .channel(`empresa-${EMPRESA_ID}`)
      .on("broadcast", { event: "pedido:atualizado" }, function (msg) {
        var payload = msg.payload as { id: string; status: StatusComanda };
        if (comanda && payload.id === comanda.id) {
          setStatus(payload.status);
        }
      })
      .subscribe();

    return function () { supabase.removeChannel(channel); };
  }, [buscarComanda, comanda]);

  async function solicitarPagamento() {
    if (!comanda) return;
    setSolicitando(true);
    setErro("");
    try {
      var r = await fetch("/api/web/comanda", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ pedidoId: comanda.id }),
      });
      var d = await r.json();
      if (d.ok) setStatus("AGUARDANDO_PAGAMENTO");
      else setErro(d.error ?? "Erro ao solicitar pagamento");
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setSolicitando(false);
    }
  }

  if (carregando) {
    return (
      <div className="max-w-screen-sm mx-auto px-4 py-16 flex justify-center">
        <div className="w-8 h-8 border-2 border-cb-amber border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!comanda) {
    return (
      <div className="max-w-screen-sm mx-auto px-4 py-20 flex flex-col items-center gap-5 text-center">
        <span className="text-7xl">🪑</span>
        <h1 className="text-2xl font-extrabold text-cb-marrom">Sem comanda ativa</h1>
        <p className="text-cb-marrom/50 text-sm leading-relaxed">
          Você não tem nenhuma comanda aberta no momento.<br />
          Faça um pedido pelo cardápio para abrir uma.
        </p>
        <Link
          href="/web/cardapio"
          className="bg-cb-marrom text-cb-bege font-bold px-8 py-3 rounded-2xl
                     hover:bg-cb-marrom/90 transition-colors"
        >
          Ir ao Cardápio
        </Link>
      </div>
    );
  }

  var totalNum = Number(comanda.total);

  return (
    <div className="max-w-screen-sm mx-auto px-4 py-8">

      {/* Header da comanda */}
      <div className="bg-cb-marrom rounded-3xl px-6 py-5 text-cb-bege mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-cb-bege/50 text-xs">Comanda</p>
            <p className="font-mono text-3xl font-extrabold tracking-wide">{comanda.senha}</p>
          </div>
          {comanda.mesa && (
            <div className="text-right">
              <p className="text-cb-bege/50 text-xs">Mesa</p>
              <p className="font-extrabold text-xl">
                {comanda.mesa.nome ?? `Mesa ${comanda.mesa.numero}`}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4">
          {status === "COMANDA_ABERTA" && (
            <span className="bg-cb-amber/20 text-cb-amber border border-cb-amber/30 text-xs font-bold
                             px-3 py-1 rounded-full">
              🪑 Comanda aberta
            </span>
          )}
          {status === "AGUARDANDO_PAGAMENTO" && (
            <span className="bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-bold
                             px-3 py-1 rounded-full animate-pulse">
              💳 Aguardando pagamento no balcão
            </span>
          )}
        </div>
      </div>

      {/* Itens */}
      <div className="bg-white border border-cb-marrom/10 rounded-2xl p-5 mb-4 shadow-sm">
        <p className="text-xs font-bold text-cb-marrom/40 uppercase tracking-widest mb-3">Itens consumidos</p>
        <div className="flex flex-col gap-3">
          {comanda.itens.map(function (item) {
            return (
              <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cb-bege overflow-hidden shrink-0">
                    {item.produto.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.produto.fotoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg opacity-20">☕</div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-cb-marrom">{item.quantidade}× {item.produto.nome}</p>
                    {item.adicionais.length > 0 && (
                      <p className="text-cb-marrom/40 text-xs">
                        + {item.adicionais.map(function (a) { return a.adicional.nome; }).join(", ")}
                      </p>
                    )}
                    {item.observacao && (
                      <p className="text-cb-marrom/40 text-xs italic">Obs: {item.observacao}</p>
                    )}
                  </div>
                </div>
                <span className="text-cb-marrom/70 font-medium shrink-0">
                  {formatarMoeda(Number(item.precoTotal))}
                </span>
              </div>
            );
          })}

          <div className="border-t border-cb-marrom/10 pt-3 flex justify-between font-extrabold text-cb-marrom">
            <span>Total da comanda</span>
            <span className="text-cb-amber">{formatarMoeda(totalNum)}</span>
          </div>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm mb-4">
          {erro}
        </div>
      )}

      {/* Ações */}
      <div className="flex flex-col gap-3">
        {status === "COMANDA_ABERTA" && (
          <>
            <Link
              href="/web/cardapio"
              className="w-full text-center border-2 border-cb-marrom text-cb-marrom font-bold
                         py-3.5 rounded-2xl hover:bg-cb-bege transition-colors"
            >
              + Adicionar mais itens
            </Link>
            <button
              onClick={solicitarPagamento}
              disabled={solicitando}
              className="w-full bg-cb-marrom text-cb-bege font-extrabold py-3.5 rounded-2xl
                         hover:bg-cb-marrom/90 transition-colors disabled:opacity-60"
            >
              {solicitando ? "Enviando..." : `💳 Solicitar pagamento • ${formatarMoeda(totalNum)}`}
            </button>
          </>
        )}

        {status === "AGUARDANDO_PAGAMENTO" && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 text-center">
            <p className="font-bold text-green-700">Pagamento solicitado!</p>
            <p className="text-green-600 text-sm mt-1">
              Dirija-se ao balcão para efetuar o pagamento de {formatarMoeda(totalNum)}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
