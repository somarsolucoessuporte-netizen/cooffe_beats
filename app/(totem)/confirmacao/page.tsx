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
  // Senha da URL é só o valor inicial; a fonte da verdade é pedido.senha do banco
  const senhaUrl = searchParams.get("senha")   ?? "CB-???";
  const pedidoId = searchParams.get("id")     ?? "";
  const isComanda = searchParams.get("comanda") === "1";

  const [senha, setSenha]                     = useState(senhaUrl);
  const [progresso, setProgresso]             = useState(100);
  const [statusAtual, setStatusAtual]         = useState("RECEBIDO");
  const [itensPedido, setItensPedido]         = useState<ItemDoPedido[]>([]);
  const [totalPedido, setTotalPedido]         = useState(0);
  const [metodoPagamento, setMetodoPagamento] = useState<string | undefined>();
  const [nomeCliente, setNomeCliente]         = useState<string | undefined>();
  const [telefoneCliente, setTelefoneCliente] = useState<string | undefined>();
  const [isMesa, setIsMesa]                   = useState(false);

  type StatusImpressao = "idle" | "printing" | "success" | "error";
  const [statusReimprimirCliente, setStatusReimprimirCliente] = useState<StatusImpressao>("idle");
  const [statusReimprimirCozinha, setStatusReimprimirCozinha] = useState<StatusImpressao>("idle");

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
        if (d.data.senha) setSenha(d.data.senha);
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

  async function handleReimprimir(via: "CLIENTE" | "COZINHA") {
    playClick();
    var setStatus = via === "CLIENTE" ? setStatusReimprimirCliente : setStatusReimprimirCozinha;
    setStatus("printing");
    var itens = buildItens();
    var resultado = await printCupom({
      numeroPedido: senha,
      itens: itens,
      total: totalPedido,
      nomeCliente: nomeCliente,
      metodoPagamento: metodoPagamento,
      via: via,
    });
    if (resultado.success) {
      setStatus("success");
      setTimeout(function() { setStatus("idle"); }, 2000);
    } else {
      setStatus("error");
      setTimeout(function() { setStatus("idle"); }, 3000);
    }
  }

  function textoBotaoReimprimir(status: StatusImpressao, textoOriginal: string) {
    if (status === "printing") return "Imprimindo...";
    if (status === "success")  return "Impresso ✓";
    if (status === "error")    return "Falha na impressão";
    return textoOriginal;
  }

  // Botão de impressão com feedback (imprimindo / impresso / falha); flex-1 ocupa largura total se estiver sozinho
  function botaoImpressao(via: "CLIENTE" | "COZINHA", status: StatusImpressao, texto: string) {
    var falhou = status === "error";
    return (
      <button
        key={via}
        onClick={function() { handleReimprimir(via); }}
        disabled={status === "printing"}
        className={
          "flex-1 min-h-[56px] flex items-center justify-center gap-2 border-2 rounded-2xl px-3 py-3 " +
          "touch-manipulation active:scale-95 transition-transform disabled:opacity-70 " +
          "font-bold text-[18px] leading-tight " +
          (falhou ? "bg-red-50 border-red-500 text-red-600" : "bg-[#F5ECD7] border-[#3B2415] text-[#3B2415]")
        }
      >
        {status === "printing" && (
          <span className="w-6 h-6 shrink-0 rounded-full border-4 border-[#3B2415]/20 border-t-[#3B2415] animate-spin" />
        )}
        <span>{textoBotaoReimprimir(status, texto)}</span>
      </button>
    );
  }

  var info = STATUS_INFO[statusAtual] ?? STATUS_INFO.RECEBIDO;

  return (
    <main className="h-full max-h-dvh overflow-y-auto overscroll-contain px-4 py-6 sm:px-8 text-center animate-fadeIn">
      <div className="min-h-full flex flex-col items-center justify-center">
        <div className="w-full max-w-lg flex shrink-0 flex-col items-center gap-5 [@media(min-height:900px)]:gap-7">
          {/* 1. Ícone de status animado */}
          <div className="check-circle">
            <svg className="w-16 h-16 [@media(min-height:900px)]:w-24 [@media(min-height:900px)]:h-24" width="120" height="120" viewBox="0 0 120 120" fill="none">
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

          {/* 2 e 3. Label + número do pedido (pedido.senha do banco) */}
          <div className="w-full flex flex-col items-center gap-2">
            <p className="text-cb-marrom/60 text-base">Seu número de pedido</p>
            <div className="max-w-full break-all font-mono text-5xl sm:text-6xl [@media(min-height:900px)]:text-7xl text-cb-marrom bg-white rounded-3xl px-6 py-3 sm:px-8
                            border border-cb-marrom/10 tracking-widest shadow-sm">
              {senha}
            </div>
          </div>

          {/* 4. Status em tempo real */}
          <div className={"flex items-center gap-3 text-xl sm:text-2xl font-extrabold transition-all " + info.cor +
                          (statusAtual === "PRONTO" ? " animate-pulse" : "")}>
            <span>{info.icone}</span>
            <span>{info.texto}</span>
          </div>

          {/* 5. Previsão de tempo */}
          <div className="w-full max-w-sm flex flex-col items-center gap-2">
            <div className="w-full bg-cb-marrom/10 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-cb-amber rounded-full transition-all duration-1000 ease-linear"
                style={{ width: progresso + "%" }}
              />
            </div>
            <p className="text-cb-marrom/50 text-base">Previsão: ~5 minutos</p>
          </div>

          {/* Comanda: mensagem de orientação */}
          {isComanda && (
            <div className="bg-cb-amber/10 border border-cb-amber/30 rounded-2xl px-6 py-4 text-center w-full">
              <p className="text-cb-marrom font-bold text-base">🪑 Comanda aberta</p>
              <p className="text-cb-marrom/60 text-sm mt-1">
                Pague ao balcão quando quiser sair.<br />
                Pode pedir mais itens quando quiser!
              </p>
            </div>
          )}

          {/* 6. Botões de ação principais — lado a lado, mesma largura */}
          <div className="flex gap-3 w-full">
            {!isMesa && (
              <button
                onClick={function() { playClick(); router.push("/"); }}
                className="flex-1 bg-cb-marrom text-cb-bege font-extrabold font-sans text-[18px]
                           py-3 px-4 rounded-full touch-manipulation btn-totem min-h-[56px]"
              >
                🏠 Início
              </button>
            )}
            <button
              onClick={function() { playClick(); router.push("/cardapio"); }}
              className="flex-1 bg-cb-amber text-white font-extrabold font-sans text-[18px]
                         py-3 px-4 rounded-full touch-manipulation btn-totem min-h-[56px]"
            >
              {isMesa ? "☕ Fazer mais pedidos" : "☕ Novo Pedido"}
            </button>
          </div>

          {/* 7. Seção de impressão — card único */}
          {impressaoAtiva && itensPedido.length > 0 && (
            <div className="w-full bg-white/60 border border-cb-marrom/10 rounded-3xl p-4 flex flex-col gap-3 mt-2">
              <div className="flex gap-3 w-full">
                {/* Comanda (mesa) não tem via do cliente: só a comanda fica, em largura total */}
                {!isComanda && botaoImpressao("CLIENTE", statusReimprimirCliente, "🖨️ Imprimir comprovante")}
                {botaoImpressao("COZINHA", statusReimprimirCozinha, "🖨️ Imprimir comanda")}
              </div>

              {!isComanda && telefoneCliente && (
                <button
                  onClick={handleWhatsApp}
                  className="w-full min-h-[56px] flex items-center justify-center gap-2 bg-[#F5ECD7]
                             border-2 border-[#16a34a] rounded-2xl px-4 py-3 touch-manipulation
                             active:scale-95 transition-transform font-bold text-[#16a34a] text-[18px]"
                >
                  📱 Receber no WhatsApp
                </button>
              )}
            </div>
          )}
        </div>
      </div>
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
