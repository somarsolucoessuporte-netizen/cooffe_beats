"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { playClick } from "@/lib/sounds";
import { useCarrinho } from "@/contexts/CarrinhoContext";
import HeaderTotem from "@/components/totem/HeaderTotem";
import { formatarMoeda } from "@/lib/utils";
import { printCupom } from "@/lib/sunmi-print";

export default function Carrinho() {
  const router = useRouter();
  const { itens, totalValor, removerItem, alterarQuantidade, limparCarrinho } = useCarrinho();
  const [confirmandoRemocao, setConfirmandoRemocao] = useState<number | null>(null);
  const [modalComanda, setModalComanda]             = useState(false);
  const [enviando, setEnviando]                     = useState(false);
  const [erroComanda, setErroComanda]               = useState("");

  // Cupom
  const [cupomCodigo,    setCupomCodigo]    = useState("");
  const [cupomAtivo,     setCupomAtivo]     = useState<{ id: string; codigo: string; desconto: number } | null>(null);
  const [aplicandoCupom, setAplicandoCupom] = useState(false);
  const [erroCupom,      setErroCupom]      = useState("");

  var totalComDesconto = cupomAtivo ? Math.max(0, totalValor - cupomAtivo.desconto) : totalValor;

  async function aplicarCupom() {
    if (!cupomCodigo.trim()) return;
    setAplicandoCupom(true);
    setErroCupom("");
    try {
      var r = await fetch("/api/cupons/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: cupomCodigo.trim().toUpperCase(), valorPedido: totalValor }),
      });
      var d = await r.json();
      if (d.ok) {
        setCupomAtivo({ id: d.data.cupom.id, codigo: d.data.cupom.codigo, desconto: d.data.desconto });
        try {
          sessionStorage.setItem("cupomId",      d.data.cupom.id);
          sessionStorage.setItem("cupomDesconto", String(d.data.desconto));
        } catch(e) {}
      } else {
        setErroCupom(d.error ?? "Cupom inválido");
      }
    } catch(e) {
      setErroCupom("Erro ao verificar cupom");
    } finally {
      setAplicandoCupom(false);
    }
  }

  function removerCupom() {
    setCupomAtivo(null);
    setCupomCodigo("");
    setErroCupom("");
    try { sessionStorage.removeItem("cupomId"); sessionStorage.removeItem("cupomDesconto"); } catch(e) {}
  }

  const temCafe = itens.some(function(i) {
    return i.nome.toLowerCase().includes("café") || i.nome.toLowerCase().includes("espresso") ||
           i.nome.toLowerCase().includes("cappuccino") || i.nome.toLowerCase().includes("latte");
  });
  const temBolo = itens.some(function(i) {
    return i.nome.toLowerCase().includes("bolo") || i.nome.toLowerCase().includes("torta");
  });
  const sugerirCombo = temCafe && !temBolo;

  async function irParaPagamento() {
    playClick();
    var mesaId = "";
    try { mesaId = sessionStorage.getItem("mesaId") ?? ""; } catch(e) {}

    if (mesaId) {
      try {
        var r = await fetch("/api/admin/mesas/" + mesaId + "/info");
        var d = await r.json();
        if (d.ok && d.data.modoPagamento === "comanda") {
          setModalComanda(true);
          return;
        }
      } catch(e) { /* segue para pagamento normal */ }
    }

    router.push("/pagamento");
  }

  async function confirmarComanda() {
    setEnviando(true);
    setErroComanda("");
    try {
      var empresaId = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";
      var mesaId    = "";
      var clienteId = "";
      try {
        mesaId    = sessionStorage.getItem("mesaId")    ?? "";
        clienteId = sessionStorage.getItem("clienteId") ?? "";
      } catch(e) {}

      var body = {
        empresaId,
        status: "COMANDA_ABERTA",
        mesaId:        mesaId        || undefined,
        clienteId:     clienteId     || undefined,
        cupomId:       cupomAtivo?.id      || undefined,
        valorDesconto: cupomAtivo?.desconto || undefined,
        itens: itens.map(function(item) {
          return {
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            precoUnit: item.preco,
            observacao: item.observacao ?? undefined,
            adicionais: item.adicionais.map(function(a) {
              return { adicionalId: a.adicionalId, preco: a.preco };
            }),
          };
        }),
      };

      var res  = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      var data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Erro ao criar pedido");

      // Imprime apenas via COZINHA (sem cupom do cliente em comanda)
      printCupom({
        numeroPedido: data.data.senha,
        itens: data.data.itens.map(function(i: { produto: { nome: string }; quantidade: number }) {
          return { nome: i.produto.nome, quantidade: i.quantidade };
        }),
        total: Number(data.data.total),
        via: "COZINHA",
      }).catch(function() {});

      limparCarrinho();
      router.push("/confirmacao?senha=" + encodeURIComponent(data.data.senha) + "&id=" + data.data.id + "&comanda=1");
    } catch(err: unknown) {
      setErroComanda(err instanceof Error ? err.message : "Erro ao registrar pedido. Tente novamente.");
      setEnviando(false);
    }
  }

  if (itens.length === 0) {
    return (
      <div className="h-full flex flex-col animate-fadeIn">
        <HeaderTotem />
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <span className="text-8xl">🛒</span>
          <p className="font-sans font-extrabold text-2xl text-cb-marrom">Seu carrinho está vazio</p>
          <p className="text-cb-marrom/60 text-lg">Adicione produtos para continuar</p>
          <button
            onClick={function() { playClick(); router.push("/cardapio"); }}
            className="bg-cb-marrom text-cb-bege font-extrabold text-lg px-10 py-5 rounded-full
                       touch-manipulation btn-totem min-h-[72px]"
          >
            Ver Cardápio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      <HeaderTotem />

      <div className="flex-1 overflow-y-auto totem-scroll p-6 flex flex-col gap-4">
        {itens.map(function(item, index) {
          return (
            <div
              key={`${item.produtoId}-${index}`}
              className="bg-white border border-cb-marrom/10 rounded-2xl p-4 flex gap-4 shadow-sm"
            >
              {/* Foto mini */}
              <div className="w-20 h-20 rounded-xl bg-cb-bege flex items-center justify-center shrink-0 overflow-hidden">
                {item.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.fotoUrl} alt={item.nome} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl opacity-20">☕</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-sans font-extrabold text-lg text-cb-marrom leading-snug truncate">
                  {item.nome}
                </p>
                {item.adicionais.length > 0 && (
                  <p className="text-xs text-cb-marrom/50 mt-1">
                    + {item.adicionais.map(function(a) { return a.nome; }).join(", ")}
                  </p>
                )}
                <p className="font-extrabold text-cb-amber mt-1">
                  {formatarMoeda((item.preco + item.adicionais.reduce(function(s, a) { return s + a.preco; }, 0)) * item.quantidade)}
                </p>
              </div>

              {/* Controles */}
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={function() { playClick(); alterarQuantidade(index, item.quantidade - 1); }}
                    className="w-10 h-10 rounded-full bg-cb-marrom/10 text-cb-marrom font-bold text-lg
                               touch-manipulation btn-totem"
                  >
                    −
                  </button>
                  <span className="font-sans font-extrabold text-xl text-cb-marrom w-6 text-center">
                    {item.quantidade}
                  </span>
                  <button
                    onClick={function() { playClick(); alterarQuantidade(index, item.quantidade + 1); }}
                    className="w-10 h-10 rounded-full bg-cb-amber text-cb-bege font-bold text-lg
                               touch-manipulation btn-totem"
                  >
                    +
                  </button>
                </div>

                {confirmandoRemocao === index ? (
                  <div className="flex gap-2">
                    <button
                      onClick={function() { removerItem(index); setConfirmandoRemocao(null); }}
                      className="text-xs bg-red-600 text-white px-3 py-1 rounded-full touch-manipulation"
                    >
                      Remover
                    </button>
                    <button
                      onClick={function() { setConfirmandoRemocao(null); }}
                      className="text-xs bg-cb-bege border border-cb-marrom/20 text-cb-marrom px-3 py-1 rounded-full touch-manipulation"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={function() { setConfirmandoRemocao(index); }}
                    className="text-cb-marrom/30 text-sm touch-manipulation p-1"
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {sugerirCombo && (
          <button
            onClick={function() { router.push("/cardapio"); }}
            className="bg-cb-amber/10 border border-cb-amber rounded-2xl p-4 text-left
                       touch-manipulation active:scale-[0.99] transition-transform"
          >
            <p className="font-sans font-extrabold text-cb-marrom text-base">🍰 Complete seu pedido!</p>
            <p className="text-cb-marrom/70 text-sm mt-1">
              Adicione um bolo ou sobremesa e monte um combo especial.
            </p>
          </button>
        )}

        <div className="h-4" />
      </div>

      {/* Rodapé */}
      <div className="shrink-0 bg-white border-t border-cb-marrom/10 p-6 flex flex-col gap-4">
        {/* Cupom */}
        {!cupomAtivo ? (
          <div className="flex flex-col gap-1">
            <div className="flex gap-2">
              <input
                type="text"
                value={cupomCodigo}
                onChange={function(e) { setCupomCodigo(e.target.value.toUpperCase()); setErroCupom(""); }}
                placeholder="Tem um cupom?"
                className="flex-1 border border-cb-marrom/20 rounded-xl px-4 py-3 text-cb-marrom
                           text-sm bg-cb-bege focus:outline-none focus:border-cb-amber uppercase
                           tracking-wider placeholder:normal-case"
              />
              <button
                onClick={aplicarCupom}
                disabled={aplicandoCupom || !cupomCodigo.trim()}
                className="bg-cb-amber text-white font-bold text-sm px-5 py-3 rounded-xl
                           disabled:opacity-50 touch-manipulation"
              >
                {aplicandoCupom ? "..." : "Aplicar"}
              </button>
            </div>
            {erroCupom && <p className="text-red-500 text-xs px-1">{erroCupom}</p>}
          </div>
        ) : (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
            <div>
              <span className="text-green-700 font-bold text-sm">🎫 {cupomAtivo.codigo}</span>
              <span className="text-green-600 text-xs ml-2">−{formatarMoeda(cupomAtivo.desconto)}</span>
            </div>
            <button onClick={removerCupom} className="text-red-400 text-xs touch-manipulation px-1">✕</button>
          </div>
        )}

        <div className="flex items-center justify-between">
          {cupomAtivo ? (
            <div>
              <p className="text-cb-marrom/50 text-sm line-through">{formatarMoeda(totalValor)}</p>
              <span className="text-cb-marrom/70 text-sm">Total com desconto</span>
            </div>
          ) : (
            <span className="text-cb-marrom/70 text-lg">Total</span>
          )}
          <span className="font-sans font-extrabold text-3xl text-cb-marrom">
            {formatarMoeda(totalComDesconto)}
          </span>
        </div>
        <div className="flex gap-4">
          <button
            onClick={function() { playClick(); router.push("/cardapio"); }}
            className="flex-1 border-2 border-cb-marrom text-cb-marrom font-extrabold font-sans text-lg
                       py-4 rounded-full touch-manipulation btn-totem min-h-[64px]"
          >
            + Itens
          </button>
          <button
            onClick={irParaPagamento}
            className="flex-[2] bg-cb-marrom text-cb-bege font-extrabold font-sans text-lg
                       py-4 rounded-full touch-manipulation btn-totem min-h-[64px]"
          >
            Ir para Pagamento
          </button>
        </div>
      </div>

      {/* Modal Comanda */}
      {modalComanda && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="bg-cb-bege rounded-3xl p-8 w-full max-w-sm flex flex-col gap-5 shadow-2xl">
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-6xl">🪑</span>
              <p className="font-extrabold text-cb-marrom text-xl">Anotar na comanda</p>
              <p className="text-cb-marrom/60 text-sm leading-relaxed">
                Seu pedido vai para a cozinha agora.<br />
                O pagamento é feito ao sair.
              </p>
            </div>

            {/* Resumo dos itens */}
            <div className="bg-white rounded-2xl p-4 flex flex-col gap-2">
              {itens.map(function(item, i) {
                var precoItem = (item.preco + item.adicionais.reduce(function(s, a) { return s + a.preco; }, 0)) * item.quantidade;
                return (
                  <div key={i} className="flex justify-between text-sm text-cb-marrom">
                    <span className="truncate flex-1 mr-2">{item.quantidade}x {item.nome}</span>
                    <span className="shrink-0 font-medium">{formatarMoeda(precoItem)}</span>
                  </div>
                );
              })}
              {cupomAtivo && (
                <div className="flex justify-between text-sm text-green-600 border-t border-cb-marrom/10 pt-2 mt-1">
                  <span>🎫 Desconto ({cupomAtivo.codigo})</span>
                  <span>−{formatarMoeda(cupomAtivo.desconto)}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-cb-marrom border-t border-cb-marrom/10 pt-2 mt-1">
                <span>Total da comanda</span>
                <span>{formatarMoeda(totalComDesconto)}</span>
              </div>
            </div>

            {erroComanda && (
              <p className="text-red-600 text-sm text-center bg-red-50 rounded-xl px-4 py-2">{erroComanda}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={function() { setModalComanda(false); setErroComanda(""); }}
                disabled={enviando}
                className="flex-1 py-3 rounded-2xl border-2 border-cb-marrom/20 text-cb-marrom font-bold
                           text-sm disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarComanda}
                disabled={enviando}
                className="flex-[2] py-3 rounded-2xl bg-cb-marrom text-cb-bege font-extrabold
                           text-sm disabled:opacity-50 transition-colors"
              >
                {enviando ? "Enviando..." : "Confirmar pedido"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
