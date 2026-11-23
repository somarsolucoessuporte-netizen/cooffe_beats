"use client";

import { useCallback, useEffect, useState } from "react";

type Secao = { id: string; nome: string; colunas: string[]; linhas: (string | number | null)[][]; total: number };

const hoje = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const somaDias = (iso: string, d: number) => new Date(new Date(iso + "T12:00:00-03:00").getTime() + d * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const fmt = (v: string | number | null) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })) : v ?? "");

export default function RelatoriosPage() {
  const [periodo, setPeriodo] = useState<"hoje" | "7d" | "mes" | "custom">("7d");
  const [custom, setCustom] = useState({ inicio: somaDias(hoje(), -7), fim: hoje() });
  const [secoes, setSecoes] = useState<Secao[] | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [aberta, setAberta] = useState("vendas-dia");

  const intervalo = useCallback(() => {
    const h = hoje();
    if (periodo === "hoje") return { inicio: h, fim: h };
    if (periodo === "7d") return { inicio: somaDias(h, -6), fim: h };
    if (periodo === "mes") return { inicio: h.slice(0, 8) + "01", fim: h };
    return custom;
  }, [periodo, custom]);

  const carregar = useCallback(async () => {
    const { inicio, fim } = intervalo();
    setCarregando(true); setErro("");
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 30000);
    try {
      const r = await fetch(`/api/relatorios/geral?inicio=${inicio}&fim=${fim}`, { cache: "no-store", signal: ctrl.signal });
      const d = await r.json().catch(() => ({ ok: false, error: `Resposta inválida (HTTP ${r.status})` }));
      if (!d.ok) throw new Error(d.error);
      setSecoes(d.data.secoes);
    } catch (e) { setErro(e instanceof DOMException && e.name === "AbortError" ? "O relatório demorou demais. Tente um período menor." : e instanceof Error ? e.message : "Erro"); }
    finally { clearTimeout(t); setCarregando(false); }
  }, [intervalo]);

  useEffect(() => { void carregar(); }, [carregar]);

  const baixar = (formato: "xlsx" | "csv", secao: string) => {
    const { inicio, fim } = intervalo();
    window.location.href = `/api/relatorios/exportar?formato=${formato}&secao=${secao}&inicio=${inicio}&fim=${fim}`;
  };

  const vendas = secoes?.find(s => s.id === "vendas-dia");
  const totalLinha = vendas?.linhas.at(-1);

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-cb-marrom">Relatórios</h1>
          <p className="text-sm text-cb-marrom/60">Dados reais de produção. Vendas contam só pagamentos aprovados, como no fechamento de caixa.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => baixar("xlsx", "tudo")} className="px-4 py-2.5 rounded-xl bg-cb-amber text-white font-bold text-sm">Exportar tudo (.xlsx)</button>
          <button onClick={() => baixar("csv", "tudo")} className="px-4 py-2.5 rounded-xl border-2 border-cb-marrom/30 text-cb-marrom font-bold text-sm">Exportar tudo (.csv)</button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {([["hoje", "Hoje"], ["7d", "7 dias"], ["mes", "Mês atual"], ["custom", "Personalizado"]] as const).map(([k, n]) => (
          <button key={k} onClick={() => setPeriodo(k)} className={`px-4 py-2 rounded-xl text-sm font-medium border ${periodo === k ? "bg-cb-marrom text-white border-cb-marrom" : "bg-white border-cb-marrom/20"}`}>{n}</button>
        ))}
        {periodo === "custom" && <>
          <input type="date" value={custom.inicio} max={custom.fim} onChange={e => setCustom(c => ({ ...c, inicio: e.target.value }))} className="border border-cb-marrom/20 rounded-xl px-3 py-2 text-sm bg-white" />
          <span className="text-sm">até</span>
          <input type="date" value={custom.fim} min={custom.inicio} onChange={e => setCustom(c => ({ ...c, fim: e.target.value }))} className="border border-cb-marrom/20 rounded-xl px-3 py-2 text-sm bg-white" />
        </>}
        {carregando && <span className="text-sm text-cb-marrom/50">Carregando…</span>}
      </div>

      {erro && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{erro} <button onClick={carregar} className="underline font-bold ml-2">Tentar novamente</button></p>}

      {totalLinha && vendas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {vendas.colunas.slice(1).map((c, i) => (
            <div key={c} className="bg-white rounded-2xl border border-cb-marrom/10 p-4"><p className="text-xs text-cb-marrom/50">{c}</p><p className="text-lg font-bold text-cb-marrom">{i === 0 ? fmt(totalLinha[i + 1]) : "R$ " + fmt(totalLinha[i + 1])}</p></div>
          ))}
        </div>
      )}

      {secoes?.map(s => (
        <div key={s.id} className="bg-white rounded-2xl border border-cb-marrom/10">
          <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <button onClick={() => setAberta(aberta === s.id ? "" : s.id)} className="text-left font-bold text-cb-marrom">{aberta === s.id ? "▾" : "▸"} {s.nome} <span className="text-xs font-normal text-cb-marrom/50">({s.total} {s.total === 1 ? "linha" : "linhas"})</span></button>
            <div className="flex gap-2">
              <button onClick={() => baixar("xlsx", s.id)} className="px-3 py-1.5 rounded-lg bg-cb-amber text-white text-xs font-bold">Exportar .xlsx</button>
              <button onClick={() => baixar("csv", s.id)} className="px-3 py-1.5 rounded-lg border border-cb-marrom/30 text-xs font-bold">Exportar .csv</button>
            </div>
          </div>
          {aberta === s.id && (
            <div className="overflow-auto max-h-96 border-t border-cb-marrom/10">
              {s.total === 0 ? <p className="p-6 text-center text-sm text-cb-marrom/50">Nenhum registro no período.</p> : (
                <table className="w-full text-xs text-cb-marrom">
                  <thead className="bg-cb-marrom/5 sticky top-0"><tr>{s.colunas.map(c => <th key={c} className="text-left px-3 py-2 font-medium whitespace-nowrap">{c}</th>)}</tr></thead>
                  <tbody>{s.linhas.map((l, i) => <tr key={i} className="border-t border-cb-marrom/5">{l.map((v, j) => <td key={j} className="px-3 py-1.5 whitespace-nowrap">{fmt(v)}</td>)}</tr>)}</tbody>
                </table>
              )}
              {s.total > s.linhas.length && <p className="p-3 text-xs text-cb-marrom/50">Mostrando {s.linhas.length} de {s.total}. A exportação traz todas as linhas.</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
