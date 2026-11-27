"use client";

import { useCallback, useRef, useState } from "react";

export type Pendencia = {
  tipo: "DIVISAO" | "PAGAMENTO"; id: string; pedidoId: string; descricao: string;
  valor: number; pago: number; criadoEm: string; temPagamento: boolean;
};

export type CaixaFechado = {
  caixaId: string; totalPedidos: number; totalVendas: number; totalDinheiro: number; totalCredito: number;
  totalDebito: number; totalPixQr: number; totalPixCnpj: number;
  abertoEm: string; fechadoEm: string | null; valorAbertura: number; jaFechado: boolean;
};

type OpcoesFechar = { caixaId?: string; observacao?: string; resolver?: boolean; forcar?: boolean };

const R$ = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

/** fetch com limite de 15 s: nunca fica carregando para sempre. */
export async function chamar(url: string, init?: RequestInit) {
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

/** Envio do fechamento: um por vez, com limite de tempo e loading sempre liberado. */
export function useFecharCaixa(aoFechar: (resumo: CaixaFechado) => void) {
  const emEnvio = useRef(false);
  const [fechando, setFechando] = useState(false);
  const [erro, setErro] = useState("");
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);

  const limpar = useCallback(() => { setErro(""); setPendencias([]); }, []);

  async function fechar(opcoes: OpcoesFechar) {
    if (emEnvio.current) return;
    emEnvio.current = true;
    setFechando(true); setErro("");
    try {
      const d = await chamar("/api/caixa/fechar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opcoes),
      });
      if (d.ok) {
        setPendencias([]);
        aoFechar(d.data as CaixaFechado);
      } else {
        if (d.pendencias) setPendencias(d.pendencias);
        setErro(d.error ?? "Erro ao fechar o caixa.");
      }
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao fechar o caixa."); }
    finally { emEnvio.current = false; setFechando(false); }
  }

  return { fechando, erro, setErro, pendencias, setPendencias, limpar, fechar };
}

const linhasPorMetodo = (r: CaixaFechado): [string, number][] => [
  ["Dinheiro", r.totalDinheiro],
  ["Crédito", r.totalCredito],
  ["Débito", r.totalDebito],
  ["Pix QR", r.totalPixQr],
  ["Pix CNPJ (manual)", r.totalPixCnpj],
];

/** Impressão separada do fechamento: se falhar, só avisa. Sem fechadoEm, imprime a parcial. */
export function imprimirFechamento(r: CaixaFechado, aoFalhar: () => void) {
  const linha = (rotulo: string, valor: string) => `<div class="linha"><span>${rotulo}</span><span>${valor}</span></div>`;
  const html = `<!DOCTYPE html><html><head>
<style>@page{size:80mm auto;margin:0}body{font-family:'Courier New',monospace;font-size:11px;width:80mm;padding:8px;margin:0}h1{text-align:center;font-size:14px;margin:4px 0}.linha{display:flex;justify-content:space-between;margin:2px 0}.sep{border-top:1px dashed #000;margin:6px 0}.bold{font-weight:bold}</style>
</head><body>
<h1>${r.fechadoEm ? "FECHAMENTO DE CAIXA" : "PARCIAL DO CAIXA"}</h1>
<div class="sep"></div>
${linha("Abertura:", dataHora(r.abertoEm))}
${linha("Fechamento:", dataHora(r.fechadoEm))}
${linha("Troco inicial:", R$(r.valorAbertura))}
${linha("Pedidos:", String(r.totalPedidos))}
<div class="sep"></div>
<div class="bold">${linha("TOTAL VENDAS:", R$(r.totalVendas))}</div>
${linhasPorMetodo(r).map(([rotulo, v]) => linha(rotulo + ":", R$(v))).join("")}
<div class="sep"></div>
<div style="text-align:center;font-size:10px">${new Date().toLocaleString("pt-BR")}</div>
</body></html>`;
  try {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    const janela = iframe.contentWindow;
    if (!janela) { iframe.remove(); aoFalhar(); return; }
    janela.document.open();
    janela.document.write(html);
    janela.document.close();
    setTimeout(() => {
      try { janela.print(); } catch { aoFalhar(); }
      setTimeout(() => iframe.remove(), 1000);
    }, 500);
  } catch { aoFalhar(); }
}

export function CaixaFechadoTela({ resumo, onAbrirNovo, onVoltar }: {
  resumo: CaixaFechado; onAbrirNovo: () => void; onVoltar: () => void;
}) {
  const [avisoImpressao, setAvisoImpressao] = useState("");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="caixa-fechado-titulo"
        className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[92vh] overflow-auto shadow-2xl flex flex-col gap-4 text-[#3B2415]">
        <div className="text-center">
          <p className="text-4xl">✅</p>
          <h2 id="caixa-fechado-titulo" className="text-2xl font-extrabold mt-1">Caixa fechado com sucesso</h2>
          <p className="text-sm text-[#3B2415]/60 mt-1">
            {resumo.jaFechado ? "Este caixa já estava fechado. " : ""}Fechado em {dataHora(resumo.fechadoEm)} · aberto em {dataHora(resumo.abertoEm)}
          </p>
        </div>

        <div className="bg-[#F6F0E5] rounded-2xl p-4 flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between text-base"><span>Total de vendas</span><strong className="text-[#C8853A]">{R$(resumo.totalVendas)}</strong></div>
          <div className="flex justify-between text-[#3B2415]/60"><span>Pedidos</span><span>{resumo.totalPedidos}</span></div>
          <div className="border-t border-[#3B2415]/10 my-1" />
          {linhasPorMetodo(resumo).map(([rotulo, valor]) => (
            <div key={rotulo} className="flex justify-between"><span>{rotulo}</span><span>{R$(valor)}</span></div>
          ))}
        </div>

        {avisoImpressao && <p role="alert" className="text-sm font-medium px-3 py-2 rounded-xl bg-amber-50 text-amber-700">{avisoImpressao}</p>}

        <button
          onClick={() => {
            setAvisoImpressao("");
            imprimirFechamento(resumo, () => setAvisoImpressao("Não foi possível imprimir. O caixa já está fechado; tente imprimir novamente."));
          }}
          className="border-2 border-[#3B2415] py-3 rounded-2xl font-bold hover:bg-[#F6F0E5]"
        >
          🖨️ Imprimir relatório
        </button>
        <div className="flex gap-3">
          <button onClick={onAbrirNovo} className="flex-1 bg-[#3B2415] text-[#F6F0E5] py-3 rounded-2xl font-bold">Abrir novo caixa</button>
          <button onClick={onVoltar} className="flex-1 border border-[#3B2415]/20 py-3 rounded-2xl font-bold">Voltar</button>
        </div>
      </div>
    </div>
  );
}
