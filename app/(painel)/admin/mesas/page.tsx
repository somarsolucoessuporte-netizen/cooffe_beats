"use client";

import { useEffect, useState } from "react";

type Mesa = {
  id: string;
  numero: number;
  nome: string | null;
  qrCode: string | null;
  ativo: boolean;
  _count: { pedidos: number };
};

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://coffeebeats.somar.ia.br";

export default function MesasPage() {
  const [mesas, setMesas]               = useState<Mesa[]>([]);
  const [carregando, setCarregando]     = useState(true);
  const [numero, setNumero]             = useState("");
  const [nome, setNome]                 = useState("");
  const [criando, setCriando]           = useState(false);
  const [mostrarForm, setMostrarForm]   = useState(false);
  const [mensagem, setMensagem]         = useState("");
  const [qrModal, setQrModal]           = useState<Mesa | null>(null);

  async function carregar() {
    const r = await fetch("/api/admin/mesas");
    const d = await r.json();
    if (d.ok) setMesas(d.data);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, []);

  async function criar() {
    if (!numero) return;
    setCriando(true);
    const r = await fetch("/api/admin/mesas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero: Number(numero), nome: nome.trim() || undefined }),
    });
    const d = await r.json();
    if (d.ok) {
      setMensagem("Mesa criada com sucesso!");
      setNumero("");
      setNome("");
      setMostrarForm(false);
      await carregar();
    } else {
      setMensagem("Erro: " + d.error);
    }
    setCriando(false);
    setTimeout(() => setMensagem(""), 4000);
  }

  async function alterarAtivo(mesa: Mesa) {
    await fetch(`/api/admin/mesas/${mesa.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !mesa.ativo }),
    });
    await carregar();
  }

  async function excluir(mesa: Mesa) {
    if (!confirm(`Excluir ${mesa.nome ?? "Mesa " + mesa.numero}?`)) return;
    const r = await fetch(`/api/admin/mesas/${mesa.id}`, { method: "DELETE" });
    const d = await r.json();
    if (d.ok) await carregar();
    else setMensagem("Erro ao excluir: " + d.error);
  }

  function imprimirQr(mesa: Mesa) {
    if (!mesa.qrCode) return;
    const url = `${BASE}/mesa/${mesa.id}`;
    const nomeMesa = mesa.nome ?? `Mesa ${mesa.numero}`;
    const html = `<!DOCTYPE html><html><head>
<style>
@page{size:148mm 210mm;margin:10mm}
body{font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;
     justify-content:center;height:calc(100vh - 20mm);margin:0;background:#F6F0E5;text-align:center}
.titulo{font-size:22px;font-weight:bold;color:#3B2415;margin-bottom:8px;letter-spacing:1px}
.mesa{font-size:36px;font-weight:900;color:#3B2415;margin:12px 0}
img{width:220px;height:220px;border:4px solid #3B2415;border-radius:12px;padding:8px;background:#fff}
.instrucao{font-size:14px;color:#6B4C2A;margin-top:12px;line-height:1.5}
.url{font-size:10px;color:#9B7C5A;margin-top:8px}
</style></head><body>
<div class="titulo">☕ COFFEE &amp; BEATS</div>
<img src="${mesa.qrCode}" alt="QR Code ${nomeMesa}" />
<div class="mesa">${nomeMesa}</div>
<div class="instrucao">Escaneie para<br/>fazer seu pedido</div>
<div class="url">${url}</div>
</body></html>`;

    var iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    if (iframe.contentWindow) {
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(html);
      iframe.contentWindow.document.close();
      setTimeout(function() {
        try { if (iframe.contentWindow) iframe.contentWindow.print(); } catch(e) {}
        setTimeout(function() { try { document.body.removeChild(iframe); } catch(e) {} }, 1000);
      }, 600);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-cb-marrom">Mesas</h1>
          <p className="text-cb-marrom/60 text-sm mt-1">Gerencie as mesas e seus QR Codes.</p>
        </div>
        <div className="flex items-center gap-3">
          {mensagem && (
            <p className={`text-sm font-medium px-4 py-2 rounded-xl ${
              mensagem.startsWith("Erro") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
            }`}>{mensagem}</p>
          )}
          <button
            onClick={() => setMostrarForm(true)}
            className="px-5 py-2.5 rounded-xl bg-cb-marrom text-cb-bege text-sm font-bold
                       hover:bg-cb-marrom/90 transition-colors"
          >
            + Nova Mesa
          </button>
        </div>
      </div>

      {/* Grid de mesas */}
      {carregando ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 bg-cb-marrom/10 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : mesas.length === 0 ? (
        <div className="text-center py-16 text-cb-marrom/40">
          <p className="text-4xl mb-3">🪑</p>
          <p className="font-medium">Nenhuma mesa cadastrada ainda.</p>
          <p className="text-sm mt-1">Clique em "+ Nova Mesa" para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {mesas.map(mesa => (
            <div
              key={mesa.id}
              className={`bg-white rounded-2xl border p-4 flex flex-col gap-3 ${
                mesa.ativo ? "border-cb-marrom/10" : "border-cb-marrom/5 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-cb-marrom text-lg">
                    {mesa.nome ?? `Mesa ${mesa.numero}`}
                  </p>
                  <p className="text-xs text-cb-marrom/50">
                    {mesa._count.pedidos} pedidos · {mesa.ativo ? "Ativa" : "Inativa"}
                  </p>
                </div>
                <span className={`w-3 h-3 rounded-full ${mesa.ativo ? "bg-green-500" : "bg-gray-300"}`} />
              </div>

              {mesa.qrCode && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mesa.qrCode}
                  alt={`QR Mesa ${mesa.numero}`}
                  className="w-24 h-24 mx-auto rounded-lg border border-cb-marrom/10"
                />
              )}

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setQrModal(mesa)}
                  className="flex-1 py-1.5 rounded-lg border border-cb-marrom/20 text-cb-marrom
                             text-xs font-medium hover:bg-cb-marrom/5 transition-colors"
                >
                  Ver QR
                </button>
                <button
                  onClick={() => imprimirQr(mesa)}
                  className="flex-1 py-1.5 rounded-lg bg-cb-amber text-white text-xs font-medium
                             hover:bg-cb-amber/90 transition-colors"
                >
                  🖨️ Imprimir
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => alterarAtivo(mesa)}
                  className="flex-1 py-1.5 rounded-lg border border-cb-marrom/10 text-cb-marrom/60
                             text-xs hover:bg-cb-marrom/5 transition-colors"
                >
                  {mesa.ativo ? "Desativar" : "Ativar"}
                </button>
                <button
                  onClick={() => excluir(mesa)}
                  className="px-3 py-1.5 rounded-lg border border-red-200 text-red-500
                             text-xs hover:bg-red-50 transition-colors"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nova Mesa */}
      {mostrarForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4">
            <h3 className="font-bold text-cb-marrom text-lg">Nova Mesa</h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-cb-marrom/70">Número *</label>
                <input
                  type="number"
                  min={1}
                  className="border border-cb-marrom/20 rounded-xl px-4 py-2.5 text-cb-marrom
                             focus:outline-none focus:ring-2 focus:ring-cb-amber/50"
                  placeholder="Ex: 5"
                  value={numero}
                  onChange={e => setNumero(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-cb-marrom/70">Nome (opcional)</label>
                <input
                  type="text"
                  className="border border-cb-marrom/20 rounded-xl px-4 py-2.5 text-cb-marrom
                             focus:outline-none focus:ring-2 focus:ring-cb-amber/50"
                  placeholder="Ex: Varanda 2"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setMostrarForm(false); setNumero(""); setNome(""); }}
                className="flex-1 py-2.5 rounded-xl border border-cb-marrom/20 text-cb-marrom text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={criar}
                disabled={criando || !numero}
                className="flex-1 py-2.5 rounded-xl bg-cb-marrom text-cb-bege text-sm font-bold
                           disabled:opacity-50 transition-colors"
              >
                {criando ? "Criando..." : "Criar Mesa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver QR Code */}
      {qrModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setQrModal(null)}
        >
          <div
            className="bg-white rounded-3xl p-8 flex flex-col items-center gap-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <p className="font-bold text-cb-marrom text-xl">
              {qrModal.nome ?? `Mesa ${qrModal.numero}`}
            </p>
            {qrModal.qrCode && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrModal.qrCode} alt="QR Code" className="w-56 h-56 rounded-xl" />
            )}
            <p className="text-cb-marrom/50 text-xs text-center">
              {BASE}/mesa/{qrModal.id}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setQrModal(null)}
                className="px-6 py-2.5 rounded-xl border border-cb-marrom/20 text-cb-marrom text-sm"
              >
                Fechar
              </button>
              <button
                onClick={() => { imprimirQr(qrModal); setQrModal(null); }}
                className="px-6 py-2.5 rounded-xl bg-cb-amber text-white text-sm font-bold"
              >
                🖨️ Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
