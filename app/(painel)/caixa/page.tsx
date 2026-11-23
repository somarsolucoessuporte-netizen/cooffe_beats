"use client";

import { useEffect, useState, useCallback } from "react";

type StatusCaixa = {
  aberto: boolean;
  caixa: {
    id: string;
    abridoEm: string;
    valorAbertura: number;
    operador: string;
    origem?: "TOTEM" | "PAINEL";
  } | null;
  resumo: {
    totalPedidos: number;
    totalVendas: number;
    totalPix: number;
    totalCartao: number;
    totalDinheiro: number;
  } | null;
};

type ItemExtrato = {
  id: string;
  senha: string;
  criadoEm: string;
  total: number;
  metodo: string | null;
  status: string;
};

type RelatorioDia = {
  data: string;
  totalPedidos: number;
  cancelados: number;
  totalVendas: number;
  totalPix: number;
  totalCartao: number;
  totalDinheiro: number;
  totalSimulado: number;
  topProdutos: { nome: string; quantidade: number; total: number }[];
  extrato: ItemExtrato[];
};

type Pendencia = {
  tipo: "DIVISAO" | "PAGAMENTO"; id: string; pedidoId: string; descricao: string;
  valor: number; pago: number; criadoEm: string; temPagamento: boolean;
};

type ResumoFechamento = {
  totalPedidos: number; totalVendas: number; totalDinheiro: number; totalCredito: number; totalDebito: number;
  totalPixQr: number; totalPixCnpj: number; totalPixDividido: number; totalCartaoDividido: number;
};

/** fetch com limite de 15 s: nunca fica carregando para sempre. */
async function chamar(url: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    const texto = await r.text();
    let d: { ok?: boolean; error?: string; data?: unknown; pendencias?: Pendencia[] } = {};
    try { d = JSON.parse(texto); } catch { d = { ok: false, error: `Resposta inválida do servidor (HTTP ${r.status})` }; }
    return { status: r.status, ...d };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new Error("O servidor demorou mais de 15 segundos para responder.");
    throw new Error("Sem conexão com o servidor.");
  } finally { clearTimeout(t); }
}

const R$ = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmt = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default function CaixaPage() {
  const [status, setStatus] = useState<StatusCaixa | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioDia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [abrindo, setAbrindo] = useState(false);
  const [fechando, setFechando] = useState(false);
  const [valorAbertura, setValorAbertura] = useState("");
  const [mostrarAbrirModal, setMostrarAbrirModal] = useState(false);
  const [mostrarFecharModal, setMostrarFecharModal] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [fechResumo, setFechResumo] = useState<ResumoFechamento | null>(null);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [conferindo, setConferindo] = useState(false);
  const [erroFechar, setErroFechar] = useState("");
  const [confirmaForcar, setConfirmaForcar] = useState(false);
  const [dataRelatorio, setDataRelatorio] = useState(new Date().toISOString().slice(0, 10));

  const carregarStatus = useCallback(async () => {
    const r = await fetch("/api/caixa/status");
    const d = await r.json();
    if (d.ok) setStatus(d.data);
    setCarregando(false);
  }, []);

  const carregarRelatorio = useCallback(async () => {
    const r = await fetch("/api/relatorios/dia?data=" + dataRelatorio);
    const d = await r.json();
    if (d.ok) setRelatorio(d.data);
  }, [dataRelatorio]);

  useEffect(() => { carregarStatus(); }, [carregarStatus]);
  useEffect(() => { carregarRelatorio(); }, [carregarRelatorio]);

  async function abrirCaixa() {
    setAbrindo(true);
    try {
      const r = await fetch("/api/caixa/abrir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valorAbertura: Number(valorAbertura) || 0 }),
      });
      const d = await r.json();
      if (d.ok) {
        setMensagem("Caixa aberto com sucesso!");
        setMostrarAbrirModal(false);
        setValorAbertura("");
        await carregarStatus();
      } else {
        setMensagem("Erro: " + d.error);
      }
    } catch { setMensagem("Erro ao abrir caixa."); }
    finally { setAbrindo(false); setTimeout(() => setMensagem(""), 4000); }
  }

  async function conferirFechamento() {
    setConferindo(true); setErroFechar(""); setConfirmaForcar(false);
    try {
      const d = await chamar("/api/caixa/fechar");
      if (d.ok) {
        const dados = d.data as { resumo: ResumoFechamento; pendencias: Pendencia[] };
        setFechResumo(dados.resumo);
        setPendencias(dados.pendencias);
      } else setErroFechar(d.error ?? "Erro ao conferir o caixa.");
    } catch (e) { setErroFechar(e instanceof Error ? e.message : "Erro ao conferir o caixa."); }
    finally { setConferindo(false); }
  }

  function abrirFechar() {
    setFechResumo(null); setPendencias([]); setErroFechar(""); setConfirmaForcar(false);
    setMostrarFecharModal(true);
    void conferirFechamento();
  }

  async function fecharCaixa(opcoes: { resolver?: boolean; forcar?: boolean } = {}) {
    setFechando(true); setErroFechar("");
    try {
      const d = await chamar("/api/caixa/fechar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opcoes),
      });
      if (d.ok) {
        setMensagem("Caixa fechado com sucesso!");
        setMostrarFecharModal(false);
        await carregarStatus();
        await carregarRelatorio();
        setTimeout(() => setMensagem(""), 4000);
      } else {
        if (d.pendencias) setPendencias(d.pendencias);
        setConfirmaForcar(false);
        setErroFechar(d.error ?? "Erro ao fechar o caixa.");
      }
    } catch (e) { setErroFechar(e instanceof Error ? e.message : "Erro ao fechar o caixa."); }
    finally { setFechando(false); }
  }

  function imprimirRelatorio() {
    if (!relatorio) return;
    const html = `<!DOCTYPE html><html><head>
<style>
@page{size:80mm auto;margin:0}
body{font-family:'Courier New',monospace;font-size:11px;width:80mm;padding:8px;margin:0}
h1{text-align:center;font-size:14px;margin:4px 0}
.linha{display:flex;justify-content:space-between;margin:2px 0}
.sep{border-top:1px dashed #000;margin:6px 0}
.bold{font-weight:bold}
</style></head><body>
<h1>RELATÓRIO DO DIA</h1>
<h1>${relatorio.data}</h1>
<div class="sep"></div>
<div class="linha"><span>Pedidos realizados:</span><span>${relatorio.totalPedidos}</span></div>
<div class="linha"><span>Cancelados:</span><span>${relatorio.cancelados}</span></div>
<div class="sep"></div>
<div class="linha bold"><span>TOTAL VENDAS:</span><span>${R$(relatorio.totalVendas)}</span></div>
<div class="linha"><span>PIX:</span><span>${R$(relatorio.totalPix)}</span></div>
<div class="linha"><span>Cartão:</span><span>${R$(relatorio.totalCartao)}</span></div>
<div class="linha"><span>Dinheiro:</span><span>${R$(relatorio.totalDinheiro)}</span></div>
<div class="sep"></div>
<div class="bold" style="margin-bottom:4px">TOP PRODUTOS</div>
${relatorio.topProdutos.map(p => `<div class="linha"><span>${p.quantidade}x ${p.nome}</span><span>${R$(p.total)}</span></div>`).join("")}
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
  }

  if (carregando) {
    return <div className="flex items-center justify-center h-64 text-cb-marrom/50">Carregando...</div>;
  }

  const estaAberto = status?.aberto;
  const resumo = status?.resumo;
  const caixa = status?.caixa;

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-cb-marrom">Caixa e Relatórios</h1>
          <p className="text-cb-marrom/60 text-sm mt-1">Controle de abertura, fechamento e relatório diário.</p>
        </div>
        {mensagem && (
          <p className={`text-sm font-medium px-4 py-2 rounded-xl ${
            mensagem.startsWith("Erro") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
          }`}>{mensagem}</p>
        )}
      </div>

      {/* Status do Caixa */}
      <div className={`rounded-2xl border p-5 flex items-start justify-between gap-4 ${
        estaAberto ? "bg-green-50 border-green-200" : "bg-cb-marrom/5 border-cb-marrom/10"
      }`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{estaAberto ? "🟢" : "🔴"}</span>
          <div>
            <p className="font-bold text-cb-marrom text-lg">
              {estaAberto ? "Caixa Aberto" : "Caixa Fechado"}
            </p>
            {caixa && caixa.origem === "TOTEM" ? (
              <p className="text-cb-marrom/60 text-sm">
                Caixa aberto às {fmt(caixa.abridoEm)} pelo totem · Troco inicial: {R$(caixa.valorAbertura)}
              </p>
            ) : caixa && (
              <p className="text-cb-marrom/60 text-sm">
                Operador: {caixa.operador} · Aberto às {fmt(caixa.abridoEm)} · Troco inicial: {R$(caixa.valorAbertura)}
              </p>
            )}
          </div>
        </div>
        <div>
          {estaAberto ? (
            <button
              onClick={abrirFechar}
              className="px-5 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors"
            >
              Fechar Caixa
            </button>
          ) : (
            <button
              onClick={() => setMostrarAbrirModal(true)}
              className="px-5 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors"
            >
              Abrir Caixa
            </button>
          )}
        </div>
      </div>

      {/* Resumo do caixa atual */}
      {estaAberto && resumo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Vendas", valor: resumo.totalVendas, icone: "💰" },
            { label: "PIX", valor: resumo.totalPix, icone: "📱" },
            { label: "Cartão", valor: resumo.totalCartao, icone: "💳" },
            { label: "Dinheiro", valor: resumo.totalDinheiro, icone: "💵" },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-2xl border border-cb-marrom/10 p-4">
              <p className="text-xs text-cb-marrom/50 mb-1">{card.icone} {card.label}</p>
              <p className="text-xl font-bold text-cb-marrom">{R$(card.valor)}</p>
            </div>
          ))}
          <div className="col-span-2 md:col-span-4 bg-white rounded-2xl border border-cb-marrom/10 p-4">
            <p className="text-xs text-cb-marrom/50 mb-1">📦 Pedidos no caixa</p>
            <p className="text-xl font-bold text-cb-marrom">{resumo.totalPedidos}</p>
          </div>
        </div>
      )}

      {/* Relatório do dia */}
      <div className="bg-white rounded-2xl border border-cb-marrom/10 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-bold text-cb-marrom">Relatório do Dia</h2>
          <div className="flex items-center gap-3">
            <input
              type="date"
              className="border border-cb-marrom/20 rounded-xl px-3 py-2 text-cb-marrom text-sm
                         focus:outline-none focus:ring-2 focus:ring-cb-amber/50"
              value={dataRelatorio}
              onChange={e => setDataRelatorio(e.target.value)}
            />
            <button
              onClick={imprimirRelatorio}
              disabled={!relatorio}
              className="px-4 py-2 rounded-xl bg-cb-amber text-white text-sm font-medium
                         hover:bg-cb-amber/90 disabled:opacity-50 transition-colors"
            >
              🖨️ Imprimir
            </button>
          </div>
        </div>

        {relatorio ? (
          <>
            {/* Totais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Vendas", valor: R$(relatorio.totalVendas), cor: "text-green-700" },
                { label: "PIX", valor: R$(relatorio.totalPix), cor: "text-blue-600" },
                { label: "Cartão", valor: R$(relatorio.totalCartao), cor: "text-purple-600" },
                { label: "Dinheiro", valor: R$(relatorio.totalDinheiro), cor: "text-cb-amber" },
              ].map(c => (
                <div key={c.label} className="bg-cb-marrom/5 rounded-xl p-3">
                  <p className="text-xs text-cb-marrom/50">{c.label}</p>
                  <p className={`font-bold ${c.cor}`}>{c.valor}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-4 text-sm text-cb-marrom/60">
              <span>📦 {relatorio.totalPedidos} pedidos</span>
              <span>❌ {relatorio.cancelados} cancelados</span>
            </div>

            {/* Top produtos */}
            {relatorio.topProdutos.length > 0 && (
              <div>
                <p className="font-medium text-cb-marrom mb-2 text-sm">Top Produtos</p>
                <div className="flex flex-col gap-1">
                  {relatorio.topProdutos.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-cb-marrom/5 last:border-0">
                      <span className="text-sm text-cb-marrom">
                        <span className="font-bold mr-2">{p.quantidade}x</span>{p.nome}
                      </span>
                      <span className="text-sm font-medium text-cb-marrom/70">{R$(p.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Extrato */}
            {relatorio.extrato.length > 0 && (
              <div>
                <p className="font-medium text-cb-marrom mb-2 text-sm">Extrato</p>
                <div className="overflow-auto max-h-64 rounded-xl border border-cb-marrom/10">
                  <table className="w-full text-xs text-cb-marrom">
                    <thead className="bg-cb-marrom/5">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Senha</th>
                        <th className="text-left px-3 py-2 font-medium">Hora</th>
                        <th className="text-left px-3 py-2 font-medium">Forma</th>
                        <th className="text-right px-3 py-2 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatorio.extrato.map(item => (
                        <tr key={item.id} className="border-t border-cb-marrom/5 hover:bg-cb-marrom/5">
                          <td className="px-3 py-2 font-mono font-bold">{item.senha}</td>
                          <td className="px-3 py-2 text-cb-marrom/60">{fmt(item.criadoEm)}</td>
                          <td className="px-3 py-2 text-cb-marrom/70">{item.metodo ?? "-"}</td>
                          <td className="px-3 py-2 text-right font-medium">{R$(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {relatorio.totalPedidos === 0 && (
              <p className="text-center text-cb-marrom/40 py-6">Nenhum pedido nesta data.</p>
            )}
          </>
        ) : (
          <p className="text-cb-marrom/40 text-center py-6">Carregando relatório...</p>
        )}
      </div>

      {/* Modal Abrir Caixa */}
      {mostrarAbrirModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4">
            <h3 className="font-bold text-cb-marrom text-lg">Abrir Caixa</h3>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-cb-marrom/70">Valor inicial (troco) — opcional</label>
              <input
                type="number"
                min={0}
                step={0.01}
                className="border border-cb-marrom/20 rounded-xl px-4 py-2.5 text-cb-marrom
                           focus:outline-none focus:ring-2 focus:ring-cb-amber/50"
                placeholder="0,00"
                value={valorAbertura}
                onChange={e => setValorAbertura(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setMostrarAbrirModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-cb-marrom/20 text-cb-marrom text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={abrirCaixa}
                disabled={abrindo}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold
                           hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {abrindo ? "Abrindo..." : "Abrir Caixa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fechar Caixa */}
      {mostrarFecharModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-auto shadow-2xl flex flex-col gap-4">
            <h3 className="font-bold text-cb-marrom text-lg">Fechar Caixa</h3>

            {conferindo && <p className="text-sm text-cb-marrom/60">Conferindo o caixa...</p>}

            {fechResumo && (
              <div className="bg-cb-marrom/5 rounded-xl p-4 flex flex-col gap-1.5 text-sm text-cb-marrom">
                <div className="flex justify-between"><span>Total vendas:</span><span className="font-bold">{R$(fechResumo.totalVendas)}</span></div>
                <div className="flex justify-between text-cb-marrom/60"><span>Pedidos:</span><span>{fechResumo.totalPedidos}</span></div>
                <div className="border-t border-cb-marrom/10 my-1" />
                <div className="flex justify-between"><span>Dinheiro</span><span>{R$(fechResumo.totalDinheiro)}</span></div>
                <div className="flex justify-between"><span>Crédito</span><span>{R$(fechResumo.totalCredito)}</span></div>
                <div className="flex justify-between"><span>Débito</span><span>{R$(fechResumo.totalDebito)}</span></div>
                <div className="flex justify-between"><span>Pix QR</span><span>{R$(fechResumo.totalPixQr)}</span></div>
                <div className="flex justify-between"><span>Pix CNPJ (manual)</span><span>{R$(fechResumo.totalPixCnpj)}</span></div>
                {(fechResumo.totalPixDividido > 0 || fechResumo.totalCartaoDividido > 0) && (
                  <div className="flex justify-between text-cb-marrom/70">
                    <span>Conta dividida (Pix / Cartão)</span>
                    <span>{R$(fechResumo.totalPixDividido)} / {R$(fechResumo.totalCartaoDividido)}</span>
                  </div>
                )}
              </div>
            )}

            {pendencias.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex flex-col gap-2 text-sm text-cb-marrom">
                <p className="font-bold">⚠️ {pendencias.length} pendência(s) neste caixa</p>
                {pendencias.map(p => (
                  <div key={p.tipo + p.id} className="flex justify-between gap-3 border-t border-amber-200 pt-2">
                    <span>
                      {p.descricao}
                      <span className="block text-xs text-cb-marrom/50">
                        desde {fmt(p.criadoEm)}{p.temPagamento ? ` · já recebido ${R$(p.pago)}` : ""}
                      </span>
                    </span>
                    <span className="font-medium whitespace-nowrap">{R$(p.valor)}</span>
                  </div>
                ))}
              </div>
            )}

            {erroFechar && (
              <p role="alert" className="text-sm font-medium px-3 py-2 rounded-xl bg-red-50 text-red-600">{erroFechar}</p>
            )}

            {pendencias.length === 0 && !conferindo && !erroFechar && (
              <p className="text-sm text-cb-marrom/60">Ao fechar o caixa, o resumo do turno será registrado. Deseja confirmar?</p>
            )}

            <div className="flex flex-col gap-2">
              {pendencias.length > 0 ? (
                <>
                  <button
                    onClick={() => fecharCaixa({ resolver: true })}
                    disabled={fechando || conferindo}
                    className="py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-50 transition-colors"
                  >
                    {fechando ? "Resolvendo..." : "Resolver pendências e fechar"}
                  </button>
                  {confirmaForcar ? (
                    <button
                      onClick={() => fecharCaixa({ forcar: true })}
                      disabled={fechando}
                      className="py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {fechando ? "Fechando..." : "Confirmar: fechar com pendências"}
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmaForcar(true)}
                      disabled={fechando || conferindo}
                      className="py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      Fechar mesmo assim
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => fecharCaixa()}
                  disabled={fechando || conferindo}
                  className="py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {fechando ? "Fechando..." : erroFechar ? "Tentar novamente" : "Confirmar Fechamento"}
                </button>
              )}
              {erroFechar && (
                <button
                  onClick={conferirFechamento}
                  disabled={conferindo || fechando}
                  className="py-2 rounded-xl border border-cb-marrom/20 text-cb-marrom text-sm font-medium disabled:opacity-50"
                >
                  Conferir novamente
                </button>
              )}
              <button
                onClick={() => setMostrarFecharModal(false)}
                disabled={fechando}
                className="py-2.5 rounded-xl border border-cb-marrom/20 text-cb-marrom text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
