"use client";

import { useRef, useState } from "react";

interface ItemNFe {
  numero: number; nome: string; unidade: string;
  quantidade: number; valorUnit: number; valorTotal: number;
}
interface Insumo { id: string; nome: string; unidade: string }
interface Mapeamento { itemNumero: number; insumoId: string }

export default function NFePage() {
  const fileRef       = useRef<HTMLInputElement>(null);
  const [fornecedor,  setFornecedor]  = useState("");
  const [nfeChave,    setNfeChave]    = useState("");
  const [itens,       setItens]       = useState<ItemNFe[]>([]);
  const [insumos,     setInsumos]     = useState<Insumo[]>([]);
  const [mapeamento,  setMapeamento]  = useState<Record<number, string>>({});
  const [processando, setProcessando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [msg,         setMsg]         = useState<{ texto: string; ok: boolean } | null>(null);

  function feedback(texto: string, ok: boolean) {
    setMsg({ texto, ok }); setTimeout(function () { setMsg(null); }, 5000);
  }

  async function processarNFe() {
    var file = fileRef.current?.files?.[0];
    if (!file) { feedback("Selecione um arquivo XML", false); return; }
    setProcessando(true);
    try {
      var fd = new FormData();
      fd.append("arquivo", file);
      var r = await fetch("/api/admin/estoque/nfe", { method: "POST", body: fd });
      var d = await r.json();
      if (!d.ok) { feedback(d.error ?? "Erro ao processar XML", false); return; }

      setFornecedor(d.data.fornecedor);
      setNfeChave(d.data.cnpj ?? "");
      setItens(d.data.itens);

      // Carrega insumos para o mapeamento
      var ins = await fetch("/api/admin/estoque/insumos").then(function (r) { return r.json(); });
      if (ins.ok) setInsumos(ins.data);

      // Mapeamento inicial vazio
      var mapa: Record<number, string> = {};
      for (var item of d.data.itens) mapa[item.numero] = "";
      setMapeamento(mapa);
    } catch { feedback("Erro ao processar arquivo", false); }
    finally { setProcessando(false); }
  }

  async function confirmar() {
    var itensMapeados = itens
      .filter(function (item) { return !!mapeamento[item.numero]; })
      .map(function (item) {
        return {
          insumoId:   mapeamento[item.numero],
          quantidade: item.quantidade,
          custo:      item.valorTotal,
        };
      });

    if (itensMapeados.length === 0) { feedback("Mapeie ao menos um item antes de confirmar", false); return; }
    setConfirmando(true);
    try {
      var r = await fetch("/api/admin/estoque/nfe/confirmar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nfeChave: nfeChave || undefined, fornecedor, itens: itensMapeados }),
      });
      var d = await r.json();
      if (d.ok) {
        feedback(`${d.data.entradas} entrada(s) registradas com sucesso!`, true);
        setItens([]); setMapeamento({}); setFornecedor("");
        if (fileRef.current) fileRef.current.value = "";
      } else feedback(d.error ?? "Erro", false);
    } catch { feedback("Erro de conexão", false); }
    finally { setConfirmando(false); }
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-cb-marrom">Importar NF-e</h1>
        <p className="text-cb-marrom/60 text-sm mt-1">
          Importe XML de Nota Fiscal Eletrônica para registrar entradas de estoque automaticamente.
        </p>
      </div>

      {/* Upload */}
      <div className="bg-white rounded-2xl border border-cb-marrom/10 p-5 shadow-sm">
        <p className="font-bold text-cb-marrom mb-3">1. Selecionar XML da NF-e</p>
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">Arquivo XML</label>
            <input
              ref={fileRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="border border-cb-marrom/20 rounded-xl px-3 py-2.5 text-sm text-cb-marrom bg-white focus:outline-none file:mr-2 file:text-xs file:font-bold file:bg-cb-amber file:text-white file:border-0 file:rounded-lg file:py-1 file:px-3"
            />
          </div>
          <button
            onClick={processarNFe} disabled={processando}
            className="bg-cb-amber text-white font-bold px-6 py-2.5 rounded-xl text-sm disabled:opacity-50 hover:bg-cb-amber/90 transition-colors whitespace-nowrap"
          >
            {processando ? "Processando..." : "Processar XML"}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.ok ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-600"}`}>
          {msg.texto}
        </div>
      )}

      {/* Mapeamento */}
      {itens.length > 0 && (
        <>
          <div className="bg-cb-bege/50 rounded-2xl border border-cb-marrom/10 p-4">
            <p className="text-sm text-cb-marrom">
              <strong>Fornecedor:</strong> {fornecedor} &nbsp;|&nbsp;
              <strong>Itens encontrados:</strong> {itens.length}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-cb-marrom/10 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-cb-marrom/10">
              <p className="font-bold text-cb-marrom">2. Mapear itens da nota → insumos do sistema</p>
              <p className="text-cb-marrom/50 text-xs mt-0.5">Itens não mapeados serão ignorados.</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-cb-bege/50">
                <tr>
                  <th className="text-left px-5 py-3 text-cb-marrom/60 font-semibold">Item da NF-e</th>
                  <th className="text-right px-3 py-3 text-cb-marrom/60 font-semibold">Qtd</th>
                  <th className="text-right px-3 py-3 text-cb-marrom/60 font-semibold">Valor Total</th>
                  <th className="px-5 py-3 text-cb-marrom/60 font-semibold">Insumo do sistema</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cb-marrom/5">
                {itens.map(function (item) {
                  return (
                    <tr key={item.numero} className="hover:bg-cb-bege/20">
                      <td className="px-5 py-3 text-cb-marrom">
                        <p className="font-medium">{item.nome}</p>
                        <p className="text-xs text-cb-marrom/40">{item.unidade}</p>
                      </td>
                      <td className="px-3 py-3 text-right text-cb-marrom/70">
                        {item.quantidade} <span className="text-xs">{item.unidade}</span>
                      </td>
                      <td className="px-3 py-3 text-right text-cb-amber font-medium">
                        R$ {item.valorTotal.toFixed(2)}
                      </td>
                      <td className="px-5 py-3">
                        <select
                          value={mapeamento[item.numero] ?? ""}
                          onChange={function (e) {
                            var v = e.target.value;
                            setMapeamento(function (m) { return { ...m, [item.numero]: v }; });
                          }}
                          className="w-full border border-cb-marrom/20 rounded-xl px-3 py-2 text-sm text-cb-marrom bg-white focus:outline-none focus:border-cb-amber"
                        >
                          <option value="">(ignorar)</option>
                          {insumos.map(function (ins) {
                            return <option key={ins.id} value={ins.id}>{ins.nome} ({ins.unidade})</option>;
                          })}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button
              onClick={confirmar} disabled={confirmando}
              className="bg-cb-marrom text-cb-bege font-extrabold px-10 py-3 rounded-2xl text-sm disabled:opacity-50 hover:bg-cb-marrom/90 transition-colors"
            >
              {confirmando ? "Confirmando..." : "✓ Confirmar entradas"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
