"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Cupom {
  id:           string;
  codigo:       string;
  tipo:         string;
  valor:        number;
  ativo:        boolean;
  usoMaximo:    number | null;
  usoAtual:     number;
  validoAte:    string | null;
  pedidoMinimo: number | null;
  criadoEm:     string;
}

const TIPO_LABEL: Record<string, string> = {
  percentual:  "% desconto",
  valor_fixo:  "R$ fixo",
};

function formatarValor(tipo: string, valor: number) {
  return tipo === "percentual"
    ? `${valor}%`
    : `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

function formatarData(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("pt-BR");
}

export default function CuponsPage() {
  const { data: session } = useSession();
  const perfil = (session?.user as { perfil?: string } | undefined)?.perfil ?? "";

  const [cupons, setCupons]         = useState<Cupom[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando]     = useState(false);
  const [erroForm, setErroForm]     = useState("");

  // Form state
  const [codigo,       setCodigo]       = useState("");
  const [tipo,         setTipo]         = useState<"percentual" | "valor_fixo">("percentual");
  const [valor,        setValor]        = useState("");
  const [usoMaximo,    setUsoMaximo]    = useState("");
  const [validoAte,    setValidoAte]    = useState("");
  const [pedidoMinimo, setPedidoMinimo] = useState("");
  const [mostrarForm,  setMostrarForm]  = useState(false);

  async function carregar() {
    setCarregando(true);
    try {
      const r = await fetch("/api/admin/cupons");
      const d = await r.json();
      if (d.ok) setCupons(d.data);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(function() { carregar(); }, []);

  async function criarCupom() {
    if (!codigo.trim() || !valor.trim()) { setErroForm("Código e valor são obrigatórios."); return; }
    setSalvando(true);
    setErroForm("");
    try {
      const r = await fetch("/api/admin/cupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo:       codigo.trim().toUpperCase(),
          tipo,
          valor:        parseFloat(valor),
          usoMaximo:    usoMaximo ? parseInt(usoMaximo, 10) : null,
          validoAte:    validoAte || null,
          pedidoMinimo: pedidoMinimo ? parseFloat(pedidoMinimo) : null,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setCodigo(""); setValor(""); setUsoMaximo(""); setValidoAte(""); setPedidoMinimo("");
        setMostrarForm(false);
        carregar();
      } else {
        setErroForm(d.error ?? "Erro ao criar cupom");
      }
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo(cupom: Cupom) {
    await fetch(`/api/admin/cupons/${cupom.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !cupom.ativo }),
    });
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este cupom?")) return;
    await fetch(`/api/admin/cupons/${id}`, { method: "DELETE" });
    carregar();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#3B2415]">Cupons de Desconto</h1>
          <p className="text-sm text-[#3B2415]/60 mt-0.5">Crie e gerencie códigos promocionais</p>
        </div>
        <button
          onClick={function() { setMostrarForm(true); setErroForm(""); }}
          className="bg-[#C8853A] text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-[#b5742e] transition-colors"
        >
          + Novo Cupom
        </button>
      </div>

      {/* Formulário */}
      {mostrarForm && (
        <div className="bg-white rounded-2xl border border-[#C8853A]/20 p-6 mb-6 shadow-sm">
          <h2 className="font-bold text-[#3B2415] mb-4">Novo Cupom</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#3B2415]/60 mb-1">Código *</label>
              <input
                value={codigo}
                onChange={function(e) { setCodigo(e.target.value.toUpperCase()); }}
                placeholder="EX: PROMO10"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none
                           focus:border-[#C8853A] uppercase tracking-wider"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#3B2415]/60 mb-1">Tipo *</label>
              <select
                value={tipo}
                onChange={function(e) { setTipo(e.target.value as "percentual" | "valor_fixo"); }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C8853A]"
              >
                <option value="percentual">Percentual (%)</option>
                <option value="valor_fixo">Valor fixo (R$)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#3B2415]/60 mb-1">
                Valor * {tipo === "percentual" ? "(%)" : "(R$)"}
              </label>
              <input
                type="number" step="0.01" min="0"
                value={valor}
                onChange={function(e) { setValor(e.target.value); }}
                placeholder={tipo === "percentual" ? "10" : "5.00"}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C8853A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#3B2415]/60 mb-1">Uso máximo</label>
              <input
                type="number" min="1"
                value={usoMaximo}
                onChange={function(e) { setUsoMaximo(e.target.value); }}
                placeholder="Ilimitado"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C8853A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#3B2415]/60 mb-1">Válido até</label>
              <input
                type="date"
                value={validoAte}
                onChange={function(e) { setValidoAte(e.target.value); }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C8853A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#3B2415]/60 mb-1">Pedido mínimo (R$)</label>
              <input
                type="number" step="0.01" min="0"
                value={pedidoMinimo}
                onChange={function(e) { setPedidoMinimo(e.target.value); }}
                placeholder="Sem mínimo"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C8853A]"
              />
            </div>
          </div>
          {erroForm && <p className="text-red-500 text-sm mt-3">{erroForm}</p>}
          <div className="flex gap-3 mt-5">
            <button
              onClick={function() { setMostrarForm(false); setErroForm(""); }}
              className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm text-[#3B2415]/60 hover:border-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={criarCupom}
              disabled={salvando}
              className="px-5 py-2.5 bg-[#C8853A] text-white font-bold rounded-xl text-sm
                         disabled:opacity-60 hover:bg-[#b5742e] transition-colors"
            >
              {salvando ? "Salvando..." : "Criar Cupom"}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {carregando ? (
        <div className="text-center py-12 text-[#3B2415]/40">Carregando...</div>
      ) : cupons.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🎫</p>
          <p className="text-[#3B2415]/50">Nenhum cupom cadastrado</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-bold text-[#3B2415]/50 uppercase tracking-wider">Código</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#3B2415]/50 uppercase tracking-wider">Tipo / Valor</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#3B2415]/50 uppercase tracking-wider">Uso</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#3B2415]/50 uppercase tracking-wider">Validade</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#3B2415]/50 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {cupons.map(function(cupom) {
                return (
                  <tr key={cupom.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-bold text-[#3B2415] tracking-widest text-sm">{cupom.codigo}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-[#3B2415]">{formatarValor(cupom.tipo, cupom.valor)}</span>
                      <span className="text-xs text-[#3B2415]/40 ml-1">({TIPO_LABEL[cupom.tipo]})</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#3B2415]">
                      {cupom.usoAtual}{cupom.usoMaximo ? `/${cupom.usoMaximo}` : ""}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#3B2415]">
                      {formatarData(cupom.validoAte)}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={function() { toggleAtivo(cupom); }}
                        className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${
                          cupom.ativo
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {cupom.ativo ? "Ativo" : "Inativo"}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {perfil === "ADMIN" && (
                        <button
                          onClick={function() { excluir(cupom.id); }}
                          className="text-red-400 hover:text-red-600 text-xs transition-colors"
                        >
                          Excluir
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-8">Somar Soluções Digitais</p>
    </div>
  );
}
