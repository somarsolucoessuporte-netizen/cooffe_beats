"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Cliente = {
  id: string;
  nome: string;
  whatsapp: string;
  totalVisitas: number;
  totalGasto: number;
  ultimaVisita: string;
  _count: { pedidos: number };
};

type Filtro = "gasto" | "visitas" | "recentes" | "inativos";

const R$ = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function diasAtras(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const dias = Math.floor(diff / 86400000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  return `${dias} dias atrás`;
}

function formatarWpp(wpp: string): string {
  // 5585999999999 → (85) 99999-9999
  const nums = wpp.replace(/\D/g, "");
  const local = nums.startsWith("55") ? nums.slice(2) : nums;
  if (local.length === 11)
    return `(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`;
  if (local.length === 10)
    return `(${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`;
  return wpp;
}

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "gasto",   label: "Maior gasto" },
  { key: "visitas", label: "Mais frequentes" },
  { key: "recentes", label: "Mais recentes" },
  { key: "inativos", label: "Inativos" },
];

export default function ClientesPage() {
  const [clientes, setClientes]     = useState<Cliente[]>([]);
  const [filtro, setFiltro]         = useState<Filtro>("gasto");
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca]           = useState("");

  async function carregar(f: Filtro) {
    setCarregando(true);
    const r = await fetch(`/api/clientes?filtro=${f}`);
    const d = await r.json();
    if (d.ok) setClientes(d.data);
    setCarregando(false);
  }

  useEffect(() => { carregar(filtro); }, [filtro]);

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.whatsapp.includes(busca.replace(/\D/g, ""))
  );

  function abrirWhatsApp(c: Cliente) {
    const nums = c.whatsapp.replace(/\D/g, "");
    const local = nums.startsWith("55") ? nums : "55" + nums;
    window.open(`https://wa.me/${local}`, "_blank", "noopener");
  }

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-cb-marrom">Clientes</h1>
        <p className="text-cb-marrom/60 text-sm mt-1">
          Clientes identificados no totem e via QR Code das mesas.
        </p>
      </div>

      {/* Barra de filtros + busca */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-cb-marrom/5 rounded-xl p-1">
          {FILTROS.map(f => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filtro === f.key
                  ? "bg-white shadow text-cb-marrom"
                  : "text-cb-marrom/50 hover:text-cb-marrom"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Buscar por nome ou WhatsApp..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="flex-1 min-w-0 border border-cb-marrom/20 rounded-xl px-4 py-2 text-sm
                     text-cb-marrom focus:outline-none focus:ring-2 focus:ring-cb-amber/40 bg-white"
        />
        <span className="text-cb-marrom/40 text-sm whitespace-nowrap">
          {filtrados.length} cliente{filtrados.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Lista */}
      {carregando ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 bg-cb-marrom/10 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 text-cb-marrom/40">
          <p className="text-4xl mb-3">👥</p>
          <p className="font-medium">Nenhum cliente encontrado.</p>
          {!busca && (
            <p className="text-sm mt-1">Os clientes aparecem ao se identificarem no totem.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtrados.map(c => (
            <div
              key={c.id}
              className="bg-white border border-cb-marrom/10 rounded-2xl px-5 py-4
                         flex items-center gap-4 hover:border-cb-marrom/20 transition-colors"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-cb-amber/20 flex items-center justify-center
                              text-cb-marrom font-bold text-lg shrink-0">
                {c.nome[0]?.toUpperCase() ?? "?"}
              </div>

              {/* Info principal */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-cb-marrom truncate">{c.nome}</p>
                <p className="text-xs text-cb-marrom/50">
                  {formatarWpp(c.whatsapp)}
                </p>
              </div>

              {/* Stats */}
              <div className="hidden sm:flex gap-6 text-center shrink-0">
                <div>
                  <p className="text-sm font-bold text-cb-marrom">{c.totalVisitas}</p>
                  <p className="text-xs text-cb-marrom/40">visitas</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-cb-amber">{R$(Number(c.totalGasto))}</p>
                  <p className="text-xs text-cb-marrom/40">gasto</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-cb-marrom/70">{diasAtras(c.ultimaVisita)}</p>
                  <p className="text-xs text-cb-marrom/40">última visita</p>
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => abrirWhatsApp(c)}
                  title="Enviar mensagem no WhatsApp"
                  className="w-9 h-9 rounded-xl bg-green-500 text-white flex items-center
                             justify-center hover:bg-green-600 transition-colors text-lg"
                >
                  💬
                </button>
                <Link
                  href={`/clientes/${c.id}`}
                  className="w-9 h-9 rounded-xl border border-cb-marrom/20 text-cb-marrom
                             flex items-center justify-center hover:bg-cb-marrom/5
                             transition-colors text-sm"
                  title="Ver histórico"
                >
                  →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
