"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { playClick } from "@/lib/sounds";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { printCupom } from "@/lib/sunmi-print";

const STATUS_INFO: Record<string, { icone: string; texto: string; cor: string }> = {
  RECEBIDO:             { icone: "⏳", texto: "Recebido",                         cor: "text-cb-amber" },
  EM_PREPARO:           { icone: "☕", texto: "Preparando seu pedido...",          cor: "text-blue-500" },
  PRONTO:               { icone: "🎉", texto: "Pronto! Retire no balcão",          cor: "text-green-500" },
  ENTREGUE:             { icone: "✅", texto: "Entregue. Bom proveito!",           cor: "text-cb-marrom/50" },
  COMANDA_ABERTA:       { icone: "🪑", texto: "Anotado na comanda!",               cor: "text-cb-amber" },
  AGUARDANDO_PAGAMENTO: { icone: "💳", texto: "Aguardando pagamento no balcão",    cor: "text-blue-500" },
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
  const senha    = searchParams.get("senha")   ?? "CB-???";
  const pedidoId = searchParams.get("id")     ?? "";
  const isComanda = searchParams.get("comanda") === "1";

  const [progresso, setProgresso]             = useState(100);
  const [statusAtual, setStatusAtual]         = useState("RECEBIDO");
  const [itensPedido, setItensPedido]         = useState<ItemDoPedido[]>([]);
  const [totalPedido, setTotalPedido]         = useState(0);
  const [metodoPagamento, setMetodoPagamento] = useState<string | undefined>();
  const [nomeCliente, setNomeCliente]         = useState<string | undefined>();
  const [telefoneCliente, setTelefoneCliente] = useState<string | undefined>();
  const [isMesa, setIsMesa]                   = useState(false);

  const duracaoMs = 5 * 60 * 1000;
  const inicioRef = useRef(Date.now());

  // Lê dados do cliente e modo mesa do sessionStorage no mount
  useEffect(function() {
    try {
      var nome  = sessionStorage.getItem("clienteNome") ?? undefined;
      var tel   = sessionStorage.getItem("clienteWpp")  ?? undefined;
      var mesa  = sessionStorage.getItem("mesaId")      ?? "";
      if (nome)  setNomeCliente(nome);
      if (tel)   setTelefoneCliente(tel.replace(/\D/g, ""));
      if (mesa)  setIsMesa(true);
    } catch(e) {}
  }, []);

  // Busca dados do pedido
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
        if (payload.id === pedidoId) setStatusAtual(payload.status);
      })
      .subscribe();

    return function() { supabase.removeChannel(channel); };
  }, [pedidoId]);

  useEffect(function() {
    var destino = isMesa ? "/cardapio" : "/";
    var t = setTimeout(function() { router.push(destino); }, 30000);
    return function() { clearTimeout(t); };
  }, [router, isMesa]);

  useEffect(function() {
    var interval = setInterval(function() {
      var decorrido = Date.now() - inicioRef.current;
      var restante  = Math.max(0, 100 - (decorrido / duracaoMs) * 100);
      setProgresso(restante);
      if (restante === 0) clearInterval(interval);
    }, 1000);
    return function() { clearInterval(interval); };
  }, [duracaoMs]);

  function buildItens() {
    return itensPedido.map(function(item) {
      var adds = item.adicionais.map(function(a) { return a.adicional.nome; });
      return {
        nome: adds.length > 0 ? item.produto.nome + " + " + adds.join(", ") : item.produto.nome,
        quantidade: item.quantidade,
        observacao: item.observacao ?? undefined,
      };
    });
  }

  function handleWhatsApp() {
    playClick();
    var itens = buildItens();

    // Imprime via COZINHA fire and forget
    printCupom({ numeroPedido: senha, itens, total: totalPedido, via: "COZINHA" })
      .catch(function() {});

    // Monta texto do comprovante
    var linhasItens = itens.map(function(i) { return i.quantidade + "x " + i.nome; }).join("\n");
    var totalFmt    = "R$" + totalPedido.toFixed(2).replace(".", ",");
    var texto = "☕ Coffee & Beats\nPedido: " + senha + "\n" + linhasItens + "\nTotal: " + totalFmt + "\nObrigado!";
    var url   = "https://wa.me/55" + telefoneCliente + "?text=" + encodeURIComponent(texto);
    window.open(url, "_blank");
  }

  function handleImprimir() {
    playClick();
    var itens = buildItens();

    printCupom({ numeroPedido: senha, itens, total: totalPedido,
                 nomeCliente: nomeCliente, metodoPagamento: metodoPagamento, via: "CLIENTE" })
      .catch(function() {});

    setTimeout(function() {
      printCupom({ numeroPedido: senha, itens, total: totalPedido, via: "COZINHA" })
        .catch(function() {});
    }, 500);
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

      {/* Botões de ação — navegação */}
      <div className="flex gap-4 mt-2">
        {!isMesa && (
          <button
            onClick={function() { playClick(); router.push("/"); }}
            className="bg-cb-marrom text-cb-bege font-extrabold font-sans text-lg
                       py-4 px-8 rounded-full touch-manipulation btn-totem min-h-[64px]"
          >
            🏠 Início
          </button>
        )}
        <button
          onClick={function() { playClick(); router.push("/cardapio"); }}
          className="bg-cb-amber text-white font-extrabold font-sans text-lg
                     py-4 px-8 rounded-full touch-manipulation btn-totem min-h-[64px]"
        >
          {isMesa ? "☕ Fazer mais pedidos" : "☕ Novo Pedido"}
        </button>
      </div>

      {/* Comanda: mensagem de orientação */}
      {isComanda && (
        <div className="bg-cb-amber/10 border border-cb-amber/30 rounded-2xl px-6 py-4 text-center max-w-sm w-full">
          <p className="text-cb-marrom font-bold text-base">🪑 Comanda aberta</p>
          <p className="text-cb-marrom/60 text-sm mt-1">
            Pague ao balcão quando quiser sair.<br />
            Pode pedir mais itens quando quiser!
          </p>
        </div>
      )}

      {/* Escolha do comprovante — apenas no modo normal (não comanda) */}
      {!isComanda && impressaoAtiva && itensPedido.length > 0 && (
        <div className="flex gap-4 w-full max-w-sm">
          {telefoneCliente && (
            <button
              onClick={handleWhatsApp}
              className="flex-1 flex flex-col items-center gap-2 bg-[#F5ECD7] border-2 border-[#16a34a]
                         rounded-2xl px-4 py-5 touch-manipulation active:scale-95 transition-transform"
            >
              <span className="text-4xl">📱</span>
              <span className="font-bold text-[#16a34a] text-sm leading-tight">Receber no</span>
              <span className="font-bold text-[#16a34a] text-sm leading-tight">WhatsApp</span>
            </button>
          )}
          <button
            onClick={handleImprimir}
            className="flex-1 flex flex-col items-center gap-2 bg-[#F5ECD7] border-2 border-[#3B2415]
                       rounded-2xl px-4 py-5 touch-manipulation active:scale-95 transition-transform"
          >
            <span className="text-4xl">🖨️</span>
            <span className="font-bold text-[#3B2415] text-sm leading-tight">Imprimir</span>
            <span className="font-bold text-[#3B2415] text-sm leading-tight">aqui</span>
          </button>
        </div>
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
