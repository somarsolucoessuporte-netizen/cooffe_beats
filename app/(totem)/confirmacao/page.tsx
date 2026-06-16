"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { playClick } from "@/lib/sounds";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { imprimirComanda } from "@/lib/imprimir-comanda";

const STATUS_INFO: Record<string, { icone: string; texto: string; cor: string }> = {
  RECEBIDO:   { icone: "⏳", texto: "Recebido",                cor: "text-cb-amber" },
  EM_PREPARO: { icone: "☕", texto: "Preparando seu pedido...", cor: "text-blue-500" },
  PRONTO:     { icone: "🎉", texto: "Pronto! Retire no balcão", cor: "text-green-500" },
  ENTREGUE:   { icone: "✅", texto: "Entregue. Bom proveito!",  cor: "text-cb-marrom/50" },
};

const impressaoAtiva = process.env.NEXT_PUBLIC_IMPRESSAO_ATIVA !== "false";

interface ItemDoPedido {
  quantidade: number;
  produto: { nome: string };
  adicionais: { adicional: { nome: string } }[];
  observacao?: string | null;
}

function ConfirmacaoConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const senha    = searchParams.get("senha") ?? "CB-???";
  const pedidoId = searchParams.get("id")    ?? "";

  const [progresso, setProgresso]             = useState(100);
  const [statusAtual, setStatusAtual]         = useState("RECEBIDO");
  const [itensPedido, setItensPedido]         = useState<ItemDoPedido[]>([]);
  const [totalPedido, setTotalPedido]         = useState(0);
  const [metodoPagamento, setMetodoPagamento] = useState<string | undefined>();

  const duracaoMs = 5 * 60 * 1000;
  const inicioRef = useRef(Date.now());

  // Busca status + dados do pedido (sem impressão automática)
  useEffect(function() {
    if (!pedidoId) return;

    fetch("/api/pedidos/" + pedidoId)
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.ok) return;
        setStatusAtual(d.data.status);
        setItensPedido(d.data.itens ?? []);
        setTotalPedido(Number(d.data.total ?? 0));
        setMetodoPagamento(d.data.pagamento?.metodo ?? undefined);
      })
      .catch(function() {});

    var empresaId = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";
    var channel = supabase
      .channel("empresa-" + empresaId)
      .on("broadcast", { event: "pedido:atualizado" }, function(msg) {
        var payload = msg.payload as { id: string; status: string };
        if (payload.id === pedidoId) {
          setStatusAtual(payload.status);
        }
      })
      .subscribe();

    return function() { supabase.removeChannel(channel); };
  }, [pedidoId]);

  useEffect(function() {
    var t = setTimeout(function() { router.push("/"); }, 30000);
    return function() { clearTimeout(t); };
  }, [router]);

  useEffect(function() {
    var interval = setInterval(function() {
      var decorrido = Date.now() - inicioRef.current;
      var restante  = Math.max(0, 100 - (decorrido / duracaoMs) * 100);
      setProgresso(restante);
      if (restante === 0) clearInterval(interval);
    }, 1000);
    return function() { clearInterval(interval); };
  }, [duracaoMs]);

  function handleImprimir() {
    playClick();
    var itens = itensPedido.map(function(item) {
      return {
        nome: item.produto.nome,
        quantidade: item.quantidade,
        adicionais: item.adicionais.map(function(a) { return a.adicional.nome; }),
        observacao: item.observacao ?? undefined,
      };
    });
    imprimirComanda({ senha: senha, itens: itens, total: totalPedido, via: "CLIENTE", metodoPagamento });
    setTimeout(function() {
      imprimirComanda({ senha: senha, itens: itens, total: totalPedido, via: "COZINHA" });
    }, 1000);
  }

  var info = STATUS_INFO[statusAtual] ?? STATUS_INFO.RECEBIDO;

  return (
    <main className="h-full flex flex-col items-center justify-center gap-8 px-8 text-center animate-fadeIn">
      {/* Check */}
      <div className="check-circle">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="56" fill="#F6F0E5" stroke="#C8853A" strokeWidth="4" />
          <path
            className="check-path"
            d="M30 62 L50 82 L90 40"
            stroke="#3B2415"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Senha */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-cb-marrom/60 text-lg">Seu número de pedido</p>
        <div className="font-mono text-7xl text-cb-marrom bg-white rounded-3xl px-8 py-5
                        border border-cb-marrom/10 tracking-widest shadow-sm">
          {senha}
        </div>
      </div>

      {/* Status em tempo real */}
      <div className={"flex items-center gap-3 text-2xl font-extrabold transition-all " + info.cor +
                      (statusAtual === "PRONTO" ? " animate-pulse" : "")}>
        <span>{info.icone}</span>
        <span>{info.texto}</span>
      </div>

      {/* Barra de progresso */}
      <div className="w-full max-w-sm bg-cb-marrom/10 rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-cb-amber rounded-full transition-all duration-1000 ease-linear"
          style={{ width: progresso + "%" }}
        />
      </div>

      <p className="text-cb-marrom/50 text-base">Previsão: ~5 minutos</p>

      {/* Botões de ação — visíveis imediatamente */}
      <div className="flex gap-4 mt-2">
        <button
          onClick={function() { playClick(); router.push("/"); }}
          className="bg-cb-marrom text-cb-bege font-extrabold font-sans text-lg
                     py-4 px-8 rounded-full touch-manipulation btn-totem min-h-[64px]"
        >
          🏠 Início
        </button>
        <button
          onClick={function() { playClick(); router.push("/cardapio"); }}
          className="bg-cb-amber text-white font-extrabold font-sans text-lg
                     py-4 px-8 rounded-full touch-manipulation btn-totem min-h-[64px]"
        >
          ☕ Novo Pedido
        </button>
      </div>

      {/* Botão de impressão manual (operador) */}
      {impressaoAtiva && itensPedido.length > 0 && (
        <button
          onClick={handleImprimir}
          className="text-cb-marrom/40 text-sm border border-cb-marrom/20 rounded-full px-5 py-2
                     hover:border-cb-marrom/50 hover:text-cb-marrom/70 transition-colors"
        >
          🖨️ Imprimir Comanda
        </button>
      )}
    </main>
  );
}

export default function Confirmacao() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center text-cb-marrom/50">
        Carregando...
      </div>
    }>
      <ConfirmacaoConteudo />
    </Suspense>
  );
}
