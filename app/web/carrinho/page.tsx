"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWebCarrinho } from "@/contexts/WebCarrinhoContext";
import { formatarMoeda } from "@/lib/utils";

interface UsuarioWeb { clienteId: string | null; nome: string }

function agora(offsetMin = 0): Date {
  return new Date(Date.now() + offsetMin * 60 * 1000);
}

function toDatetimeLocal(d: Date): string {
  var pad = function (n: number) { return n.toString().padStart(2, "0"); };
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function horaDisplay(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function WebCarrinho() {
  const router = useRouter();
  const { itens, totalValor, alterarQuantidade, removerItem, limparCarrinho, hidratado } = useWebCarrinho();

  const [usuario,       setUsuario]       = useState<UsuarioWeb | null>(null);
  const [sumupAtivo,    setSumupAtivo]    = useState(false);
  const [tempoMedio,    setTempoMedio]    = useState(30);

  // Cupom
  const [cupomCodigo,   setCupomCodigo]   = useState("");
  const [cupomAtivo,    setCupomAtivo]    = useState<{ id: string; codigo: string; desconto: number } | null>(null);
  const [erroCupom,     setErroCupom]     = useState("");
  const [aplicando,     setAplicando]     = useState(false);

  // Previsão de chegada
  const [previsao,      setPrevisao]      = useState<Date>(() => agora(30));
  const [customMode,    setCustomMode]    = useState(false);

  // Checkout
  const [finalizando,   setFinalizando]   = useState(false);
  const [erroCheckout,  setErroCheckout]  = useState("");

  var totalComDesconto = cupomAtivo ? Math.max(0, totalValor - cupomAtivo.desconto) : totalValor;

  // Carrega dados do usuário e configurações
  useEffect(function () {
    fetch("/api/web/me")
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d.ok) setUsuario({ clienteId: d.data.clienteId, nome: d.data.nome }); })
      .catch(function () {});

    fetch("/api/web/config")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) {
          setSumupAtivo(d.data.sumupOnlineAtivo ?? false);
          var tm = d.data.tempoMedioMinutos ?? 30;
          setTempoMedio(tm);
          setPrevisao(agora(tm));
        }
      })
      .catch(function () {});
  }, []);

  const aplicarCupom = useCallback(async function () {
    if (!cupomCodigo.trim()) return;
    setAplicando(true); setErroCupom("");
    try {
      var r = await fetch("/api/cupons/validar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: cupomCodigo.trim().toUpperCase(), valorPedido: totalValor }),
      });
      var d = await r.json();
      if (d.ok) setCupomAtivo({ id: d.data.cupom.id, codigo: d.data.cupom.codigo, desconto: d.data.desconto });
      else setErroCupom(d.error ?? "Cupom inválido");
    } catch { setErroCupom("Erro ao verificar cupom"); }
    finally { setAplicando(false); }
  }, [cupomCodigo, totalValor]);

  function removerCupom() { setCupomAtivo(null); setCupomCodigo(""); setErroCupom(""); }

  // Pagar no balcão (sem SumUp)
  async function finalizarNormal() {
    if (!usuario?.clienteId) { setErroCheckout("Erro ao identificar sua conta. Recarregue a página."); return; }
    setFinalizando(true); setErroCheckout("");
    try {
      var res = await fetch("/api/web/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itens: itens.map(function (i) { return { produtoId: i.produtoId, quantidade: i.quantidade, precoUnit: i.preco }; }),
          cupomId:       cupomAtivo?.id       ?? undefined,
          valorDesconto: cupomAtivo?.desconto ?? undefined,
        }),
      });
      var data = await res.json();
      if (!data.ok) { setErroCheckout(data.error ?? "Erro ao finalizar pedido"); return; }
      limparCarrinho();
      router.push(`/web/pedido/${data.data.id}`);
    } catch { setErroCheckout("Erro de conexão. Tente novamente."); }
    finally { setFinalizando(false); }
  }

  // Pagar online com SumUp
  async function finalizarSumup() {
    if (!usuario?.clienteId) { setErroCheckout("Erro ao identificar sua conta. Recarregue a página."); return; }
    setFinalizando(true); setErroCheckout("");
    try {
      var res = await fetch("/api/web/pagamento/sumup/criar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itens: itens.map(function (i) {
            return { produtoId: i.produtoId, nome: i.nome, preco: i.preco, quantidade: i.quantidade, fotoUrl: i.fotoUrl };
          }),
          total:           totalComDesconto,
          previsaoChegada: previsao.toISOString(),
          cupomId:         cupomAtivo?.id       ?? undefined,
          valorDesconto:   cupomAtivo?.desconto ?? undefined,
        }),
      });
      var data = await res.json();
      if (!data.ok) { setErroCheckout(data.error ?? "Erro ao iniciar pagamento"); return; }
      limparCarrinho();
      window.location.href = data.data.checkoutUrl; // redireciona para SumUp
    } catch { setErroCheckout("Erro de conexão. Tente novamente."); }
    finally { setFinalizando(false); }
  }

  if (!hidratado) {
    return (
      <div className="max-w-screen-md mx-auto px-4 py-16 flex justify-center">
        <div className="w-8 h-8 border-2 border-cb-amber border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (itens.length === 0) {
    return (
      <div className="max-w-screen-md mx-auto px-4 py-20 flex flex-col items-center gap-6 text-center">
        <span className="text-8xl">🛒</span>
        <h1 className="text-2xl font-extrabold text-cb-marrom">Carrinho vazio</h1>
        <p className="text-cb-marrom/50">Escolha seus produtos favoritos no cardápio.</p>
        <Link href="/web/cardapio" className="bg-cb-marrom text-cb-bege font-bold px-8 py-3 rounded-2xl hover:bg-cb-marrom/90 transition-colors">
          Ver Cardápio
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold text-cb-marrom mb-6">
        Meu Carrinho
        <span className="text-cb-marrom/40 font-normal text-base ml-2">
          ({itens.reduce(function (s, i) { return s + i.quantidade; }, 0)} itens)
        </span>
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

        {/* Lista de itens */}
        <div className="flex flex-col gap-3">
          {itens.map(function (item, idx) {
            return (
              <div key={item.produtoId + idx} className="bg-white border border-cb-marrom/10 rounded-2xl p-4 flex gap-4 shadow-sm">
                <div className="w-16 h-16 rounded-xl bg-cb-bege overflow-hidden shrink-0">
                  {item.fotoUrl
                    ? <img src={item.fotoUrl} alt={item.nome} className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                    : <div className="w-full h-full flex items-center justify-center text-2xl opacity-20">☕</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-cb-marrom leading-snug truncate">{item.nome}</p>
                  <p className="text-cb-amber font-extrabold mt-0.5">{formatarMoeda(item.preco * item.quantidade)}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <button onClick={function () { alterarQuantidade(item.produtoId, item.quantidade - 1); }}
                      className="w-8 h-8 rounded-full bg-cb-marrom/10 text-cb-marrom font-bold text-sm flex items-center justify-center hover:bg-cb-marrom/20 transition-colors">−</button>
                    <span className="font-bold text-cb-marrom w-5 text-center">{item.quantidade}</span>
                    <button onClick={function () { alterarQuantidade(item.produtoId, item.quantidade + 1); }}
                      className="w-8 h-8 rounded-full bg-cb-amber text-white font-bold text-sm flex items-center justify-center hover:bg-cb-amber/90 transition-colors">+</button>
                  </div>
                  <button onClick={function () { removerItem(item.produtoId); }} className="text-red-400 text-xs hover:text-red-600 transition-colors">Remover</button>
                </div>
              </div>
            );
          })}
          <Link href="/web/cardapio" className="text-cb-amber text-sm font-semibold hover:underline self-start mt-1">
            + Adicionar mais itens
          </Link>
        </div>

        {/* Resumo */}
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-cb-marrom/10 rounded-2xl p-5 shadow-sm">
            <p className="font-extrabold text-cb-marrom mb-4">Resumo do pedido</p>

            {/* Cupom */}
            {!cupomAtivo ? (
              <div className="flex flex-col gap-1 mb-4">
                <div className="flex gap-2">
                  <input type="text" value={cupomCodigo}
                    onChange={function (e) { setCupomCodigo(e.target.value.toUpperCase()); setErroCupom(""); }}
                    placeholder="Código de cupom"
                    className="flex-1 border border-cb-marrom/20 rounded-xl px-3 py-2.5 text-sm text-cb-marrom bg-cb-bege/50 focus:outline-none focus:border-cb-amber uppercase tracking-wider placeholder:normal-case" />
                  <button onClick={aplicarCupom} disabled={aplicando || !cupomCodigo.trim()}
                    className="bg-cb-amber text-white text-sm font-bold px-4 py-2.5 rounded-xl disabled:opacity-50 hover:bg-cb-amber/90 transition-colors">
                    {aplicando ? "..." : "Aplicar"}
                  </button>
                </div>
                {erroCupom && <p className="text-red-500 text-xs">{erroCupom}</p>}
              </div>
            ) : (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-3 py-2 mb-4">
                <div>
                  <span className="text-green-700 font-bold text-sm">🎫 {cupomAtivo.codigo}</span>
                  <span className="text-green-600 text-xs ml-2">−{formatarMoeda(cupomAtivo.desconto)}</span>
                </div>
                <button onClick={removerCupom} className="text-red-400 text-xs hover:text-red-600 px-1">✕</button>
              </div>
            )}

            {/* Totais */}
            <div className="flex flex-col gap-2 text-sm border-t border-cb-marrom/10 pt-3">
              <div className="flex justify-between text-cb-marrom/70">
                <span>Subtotal</span><span>{formatarMoeda(totalValor)}</span>
              </div>
              {cupomAtivo && (
                <div className="flex justify-between text-green-600">
                  <span>Desconto</span><span>−{formatarMoeda(cupomAtivo.desconto)}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-cb-marrom text-base pt-2 border-t border-cb-marrom/10">
                <span>Total</span><span>{formatarMoeda(totalComDesconto)}</span>
              </div>
            </div>
          </div>

          {/* Previsão de chegada */}
          <div className="bg-white border border-cb-marrom/10 rounded-2xl p-5 shadow-sm">
            <p className="font-extrabold text-cb-marrom mb-1">☕ Quando você vai chegar?</p>
            <p className="text-cb-marrom/50 text-xs mb-3">
              Nos ajuda a ter seu pedido pronto na hora certa.
            </p>

            {/* Opções rápidas */}
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { label: `+${tempoMedio}min`, min: tempoMedio },
                { label: "+30min",  min: 30 },
                { label: "+1h",     min: 60 },
                { label: "+2h",     min: 120 },
              ].filter(function (o, idx, arr) {
                // Remove duplicata se tempoMedio já for 30
                return arr.findIndex(function (x) { return x.min === o.min; }) === idx;
              }).map(function (opt) {
                var hora = agora(opt.min);
                var ativo = !customMode && Math.abs(previsao.getTime() - hora.getTime()) < 60_000;
                return (
                  <button
                    key={opt.label}
                    onClick={function () { setPrevisao(hora); setCustomMode(false); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      ativo ? "bg-cb-marrom text-cb-bege" : "border border-cb-marrom/20 text-cb-marrom hover:bg-cb-bege"
                    }`}
                  >
                    {opt.label} ({horaDisplay(hora)})
                  </button>
                );
              })}
              <button
                onClick={function () { setCustomMode(true); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  customMode ? "bg-cb-marrom text-cb-bege" : "border border-cb-marrom/20 text-cb-marrom hover:bg-cb-bege"
                }`}
              >
                Escolher horário
              </button>
            </div>

            {/* Input de horário customizado */}
            {customMode && (
              <input
                type="datetime-local"
                value={toDatetimeLocal(previsao)}
                min={toDatetimeLocal(agora())}
                onChange={function (e) { if (e.target.value) setPrevisao(new Date(e.target.value)); }}
                className="w-full border border-cb-marrom/20 rounded-xl px-3 py-2.5 text-sm
                           text-cb-marrom bg-white focus:outline-none focus:border-cb-amber transition-colors"
              />
            )}

            <p className="text-cb-marrom/60 text-xs mt-2 font-medium">
              Previsão selecionada: <strong>{horaDisplay(previsao)}</strong>
            </p>
          </div>

          {erroCheckout && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
              {erroCheckout}
            </div>
          )}

          {/* Botão SumUp (pagar online) */}
          {sumupAtivo && (
            <button
              onClick={finalizarSumup}
              disabled={finalizando || !usuario?.clienteId}
              className="w-full bg-cb-amber text-white font-extrabold py-4 rounded-2xl
                         hover:bg-cb-amber/90 transition-colors disabled:opacity-60 text-base
                         flex items-center justify-center gap-2"
            >
              {finalizando ? "Processando..." : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                    <line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                  Pagar online • {formatarMoeda(totalComDesconto)}
                </>
              )}
            </button>
          )}

          {/* Botão pagar no balcão */}
          <button
            onClick={finalizarNormal}
            disabled={finalizando || !usuario?.clienteId}
            className={`w-full font-extrabold py-4 rounded-2xl transition-colors disabled:opacity-60 text-base ${
              sumupAtivo
                ? "border-2 border-cb-marrom text-cb-marrom hover:bg-cb-bege"
                : "bg-cb-marrom text-cb-bege hover:bg-cb-marrom/90"
            }`}
          >
            {finalizando ? "Enviando..." : `${sumupAtivo ? "Pagar no balcão" : "Finalizar Pedido"} • ${formatarMoeda(totalComDesconto)}`}
          </button>

          <p className="text-cb-marrom/40 text-xs text-center">
            {sumupAtivo ? "Pagamento online via SumUp ou presencial ao retirar" : "Pagamento presencial ao retirar no balcão"}
          </p>
        </div>
      </div>
    </div>
  );
}
