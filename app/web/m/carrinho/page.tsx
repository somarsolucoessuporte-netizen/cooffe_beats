"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Coffee, Minus, Plus, Trash2 } from "lucide-react";
import { useWebCarrinho, chaveItem, type ItemWebCarrinho } from "@/contexts/WebCarrinhoContext";
import { buscarRotuloMesa, lerSessaoMesa } from "@/lib/sessao-mesa";
import { formatarMoeda } from "@/lib/utils";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

// Soma dos adicionais de um item do carrinho
function totalAdicionais(item: ItemWebCarrinho): number {
  return (item.adicionais ?? []).reduce(function (s, a) { return s + a.preco; }, 0);
}

// Carrinho do cardápio da mesa: envia o pedido para a comanda aberta da mesa,
// pelo mesmo endpoint do totem (POST /api/pedidos com status COMANDA_ABERTA)
export default function CarrinhoMesa() {
  const { itens, totalValor, totalItens, alterarQuantidade, removerItem, limparCarrinho, hidratado } = useWebCarrinho();

  const [mesaId,     setMesaId]     = useState("");
  const [clienteId,  setClienteId]  = useState("");
  const [rotuloMesa, setRotuloMesa] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviando,   setEnviando]   = useState(false);
  const [erro,       setErro]       = useState("");
  const [senha,      setSenha]      = useState<string | null>(null);

  useEffect(function () {
    const sessao = lerSessaoMesa();
    setMesaId(sessao.mesaId);
    setClienteId(sessao.clienteId);
    if (sessao.mesaId) {
      buscarRotuloMesa(sessao.mesaId).then(function (r) { if (r) setRotuloMesa(r); });
    }
  }, []);

  async function enviarPedido() {
    if (!mesaId) { setErro("Mesa não identificada. Escaneie o QR Code da mesa novamente."); return; }
    setEnviando(true);
    setErro("");
    try {
      const res = await fetch("/api/pedidos", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId:  EMPRESA_ID,
          status:     "COMANDA_ABERTA",
          mesaId,
          clienteId:  clienteId || undefined,
          observacao: observacao.trim() || undefined,
          itens: itens.map(function (item) {
            // No carrinho web o preço já inclui os adicionais; a API soma os adicionais
            // separadamente, então envia o preço base do produto
            return {
              produtoId:  item.produtoId,
              quantidade: item.quantidade,
              precoUnit:  item.preco - totalAdicionais(item),
              adicionais: (item.adicionais ?? []).map(function (a) {
                return { adicionalId: a.adicionalId, preco: a.preco };
              }),
            };
          }),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Erro ao enviar pedido");
      limparCarrinho();
      setSenha(data.data.senha);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar pedido. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  // Pedido enviado
  if (senha) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-[calc(100dvh-64px)] flex flex-col items-center justify-center gap-4 px-8 text-center"
      >
        <CheckCircle2 size={64} className="text-green-600" />
        <h1 className="text-2xl font-extrabold text-[#3B2415]">Pedido enviado!</h1>
        <p className="text-sm text-[#3B2415]/60">
          Anotado na comanda{rotuloMesa ? " da " + rotuloMesa : ""}. É só aguardar na mesa.
        </p>
        <div className="rounded-2xl bg-[#F6F0E5] border border-[#C8A96E] px-8 py-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#3B2415]/50">Senha</p>
          <p className="text-3xl font-extrabold text-[#3B2415]">{senha}</p>
        </div>
        <Link href="/web/m" className="mt-2 w-full h-14 rounded-xl bg-[#3B2415] text-cb-bege font-bold flex items-center justify-center">
          Voltar ao cardápio
        </Link>
      </motion.div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-64px)] flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-30 h-16 px-4 flex items-center justify-between bg-[#3B2415]">
        <Link href="/web/m" className="flex items-center gap-1.5 text-cb-bege text-sm font-bold">
          <ArrowLeft size={18} /> Cardápio
        </Link>
        <div className="text-right leading-tight">
          <p className="text-cb-bege text-sm font-bold">Meu pedido</p>
          {rotuloMesa && <p className="text-[#C8A96E] text-xs font-semibold">{rotuloMesa}</p>}
        </div>
      </header>

      {!hidratado ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#C8A96E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : itens.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <Coffee size={48} className="text-[#C8A96E]" />
          <p className="text-lg font-extrabold text-[#3B2415]">Seu carrinho está vazio</p>
          <Link href="/web/m" className="h-12 px-8 rounded-xl bg-[#3B2415] text-cb-bege font-bold flex items-center">
            Ver cardápio
          </Link>
        </div>
      ) : (
        <>
          {/* ITENS */}
          <ul className="flex flex-col divide-y divide-gray-100 px-4">
            <AnimatePresence initial={false}>
              {itens.map(function (item) {
                const chave = chaveItem(item);
                return (
                  <motion.li
                    key={chave}
                    layout
                    exit={{ opacity: 0, x: -40 }}
                    className="py-3 flex items-center gap-3"
                  >
                    {item.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.fotoUrl} alt={item.nome} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-[#F6F0E5] flex items-center justify-center text-[#C8A96E] shrink-0">
                        <Coffee size={24} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#3B2415] truncate">{item.nome}</p>
                      {item.adicionais && item.adicionais.length > 0 && (
                        <p className="text-xs text-gray-500 truncate">
                          + {item.adicionais.map(function (a) { return a.nome; }).join(", ")}
                        </p>
                      )}
                      <p className="text-sm font-bold text-[#C8A96E] mt-0.5">{formatarMoeda(item.preco * item.quantidade)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.9 }}
                        aria-label={item.quantidade > 1 ? "Diminuir" : "Remover"}
                        onClick={function () {
                          if (item.quantidade > 1) alterarQuantidade(chave, item.quantidade - 1);
                          else removerItem(chave);
                        }}
                        className="w-9 h-9 rounded-full border border-[#3B2415]/20 text-[#3B2415] flex items-center justify-center"
                      >
                        {item.quantidade > 1 ? <Minus size={16} /> : <Trash2 size={16} />}
                      </motion.button>
                      <span className="w-5 text-center font-extrabold text-[#3B2415]">{item.quantidade}</span>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.9 }}
                        aria-label="Aumentar"
                        onClick={function () { alterarQuantidade(chave, item.quantidade + 1); }}
                        className="w-9 h-9 rounded-full bg-[#3B2415] text-white flex items-center justify-center"
                      >
                        <Plus size={16} />
                      </motion.button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>

          {/* OBSERVAÇÃO */}
          <div className="px-4 pt-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400" htmlFor="obs">
              Observação
            </label>
            <textarea
              id="obs"
              rows={2}
              value={observacao}
              onChange={function (e) { setObservacao(e.target.value); }}
              placeholder="Ex.: sem açúcar, leite sem lactose…"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-base text-[#3B2415]
                         focus:outline-none focus:border-[#C8A96E]"
            />
          </div>

          {/* RODAPÉ: total + enviar */}
          <div className="mt-auto sticky bottom-[calc(64px+env(safe-area-inset-bottom))] bg-white px-4 pt-3 pb-4 border-t border-gray-100">
            {erro && <p className="mb-2 text-sm text-red-600">{erro}</p>}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{totalItens} {totalItens === 1 ? "item" : "itens"}</span>
              <span className="text-lg font-extrabold text-[#3B2415]">{formatarMoeda(totalValor)}</span>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              disabled={enviando}
              onClick={enviarPedido}
              className="w-full h-14 rounded-xl bg-[#3B2415] text-cb-bege font-bold text-[15px] disabled:opacity-60"
            >
              {enviando ? "Enviando…" : "Enviar pedido para a mesa"}
            </motion.button>
            <p className="mt-2 text-center text-xs text-gray-400">O pagamento é feito no fechamento da comanda.</p>
          </div>
        </>
      )}
    </div>
  );
}
