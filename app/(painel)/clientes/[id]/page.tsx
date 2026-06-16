"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

type ItemPedido = {
  id: string;
  produto: { nome: string };
  quantidade: number;
  precoTotal: number;
};

type PedidoCliente = {
  id: string;
  senha: string;
  criadoEm: string;
  total: number;
  status: string;
  pagamento: { metodo: string } | null;
  itens: ItemPedido[];
};

type ClienteDetalhe = {
  id: string;
  nome: string;
  whatsapp: string;
  totalVisitas: number;
  totalGasto: number;
  ultimaVisita: string;
  criadoEm: string;
  pedidos: PedidoCliente[];
};

const R$ = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_COR: Record<string, string> = {
  RECEBIDO:   "bg-cb-amber/20 text-cb-marrom",
  EM_PREPARO: "bg-blue-100 text-blue-700",
  PRONTO:     "bg-green-100 text-green-700",
  ENTREGUE:   "bg-gray-100 text-gray-600",
  CANCELADO:  "bg-red-100 text-red-600",
};

function formatarWpp(wpp: string): string {
  const nums = wpp.replace(/\D/g, "");
  const local = nums.startsWith("55") ? nums.slice(2) : nums;
  if (local.length === 11) return `(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`;
  return wpp;
}

export default function ClienteDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [cliente, setCliente] = useState<ClienteDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch(`/api/clientes/${id}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setCliente(d.data); })
      .finally(() => setCarregando(false));
  }, [id]);

  if (carregando) {
    return <div className="flex items-center justify-center h-64 text-cb-marrom/40">Carregando...</div>;
  }

  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-cb-marrom/60">Cliente não encontrado.</p>
        <Link href="/clientes" className="text-cb-amber underline text-sm">← Voltar</Link>
      </div>
    );
  }

  const wppNums = cliente.whatsapp.replace(/\D/g, "");
  const wppLocal = wppNums.startsWith("55") ? wppNums : "55" + wppNums;

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href="/clientes"
          className="text-cb-marrom/50 hover:text-cb-marrom text-sm flex items-center gap-1"
        >
          ← Clientes
        </Link>
      </div>

      {/* Perfil */}
      <div className="bg-white border border-cb-marrom/10 rounded-2xl p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-cb-amber/20 flex items-center justify-center
                        text-cb-marrom font-extrabold text-2xl shrink-0">
          {cliente.nome[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-cb-marrom text-xl">{cliente.nome}</p>
          <p className="text-cb-marrom/50 text-sm">{formatarWpp(cliente.whatsapp)}</p>
          <p className="text-cb-marrom/40 text-xs mt-0.5">
            Cliente desde {new Date(cliente.criadoEm).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <a
          href={`https://wa.me/${wppLocal}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-xl bg-green-500 text-white text-sm font-medium
                     hover:bg-green-600 transition-colors"
        >
          💬 WhatsApp
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Visitas",       valor: String(cliente.totalVisitas),          icone: "🔁" },
          { label: "Total gasto",   valor: R$(Number(cliente.totalGasto)),         icone: "💰" },
          { label: "Última visita", valor: new Date(cliente.ultimaVisita).toLocaleDateString("pt-BR"), icone: "📅" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-cb-marrom/10 rounded-2xl p-4 text-center">
            <p className="text-xl mb-1">{s.icone}</p>
            <p className="font-bold text-cb-marrom">{s.valor}</p>
            <p className="text-xs text-cb-marrom/40">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Histórico */}
      <div>
        <h2 className="font-bold text-cb-marrom mb-3">Histórico de Pedidos</h2>
        {cliente.pedidos.length === 0 ? (
          <p className="text-cb-marrom/40 text-sm text-center py-8">Nenhum pedido registrado.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {cliente.pedidos.map(p => (
              <div key={p.id} className="bg-white border border-cb-marrom/10 rounded-2xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-cb-marrom">{p.senha}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COR[p.status] ?? "bg-gray-100"}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-cb-amber">{R$(Number(p.total))}</p>
                    <p className="text-xs text-cb-marrom/40">
                      {new Date(p.criadoEm).toLocaleDateString("pt-BR")} ·{" "}
                      {new Date(p.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-cb-marrom/60">
                  {p.itens.map(i => `${i.quantidade}x ${i.produto.nome}`).join(" · ")}
                </p>
                {p.pagamento && (
                  <p className="text-xs text-cb-marrom/40">{p.pagamento.metodo}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
