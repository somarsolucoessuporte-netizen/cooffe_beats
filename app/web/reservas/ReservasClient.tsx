"use client";

import { useState, useEffect, useCallback } from "react";

interface Mesa {
  id:     string;
  numero: number;
  nome:   string | null;
}

interface Agendamento {
  id:          string;
  data:        string;
  duracao:     number;
  pessoas:     number;
  status:      string;
  observacao:  string | null;
  mesa:        { numero: number; nome: string | null } | null;
}

interface Props {
  clienteNome:     string;
  clienteWhatsapp: string;
  mesas:           Mesa[];
}

const STATUS_LABEL: Record<string, string> = {
  PENDENTE:   "Aguardando confirmação",
  CONFIRMADO: "Confirmado",
  CANCELADO:  "Cancelado",
};

const STATUS_COR: Record<string, string> = {
  PENDENTE:   "text-amber-600 bg-amber-50 border-amber-200",
  CONFIRMADO: "text-green-700 bg-green-50 border-green-200",
  CANCELADO:  "text-red-600 bg-red-50 border-red-200",
};

function toLocalDatetimeValue(offset = 0): string {
  var d = new Date(Date.now() + offset);
  var pad = function (n: number) { return n.toString().padStart(2, "0"); };
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ReservasClient({ clienteNome, clienteWhatsapp, mesas }: Props) {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [carregando,   setCarregando]   = useState(true);
  const [enviando,     setEnviando]     = useState(false);
  const [sucesso,      setSucesso]      = useState(false);
  const [erro,         setErro]         = useState("");

  // Campos do formulário
  const [data,       setData]       = useState(() => toLocalDatetimeValue(3600_000)); // +1h
  const [pessoas,    setPessoas]    = useState(2);
  const [mesaId,     setMesaId]     = useState("");
  const [observacao, setObservacao] = useState("");

  const buscarAgendamentos = useCallback(async function () {
    setCarregando(true);
    try {
      var r = await fetch("/api/web/agendamentos");
      var d = await r.json();
      if (d.ok) setAgendamentos(d.data);
    } catch {}
    finally { setCarregando(false); }
  }, []);

  useEffect(function () { buscarAgendamentos(); }, [buscarAgendamentos]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    setSucesso(false);
    try {
      var r = await fetch("/api/web/agendamentos", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          pessoas,
          mesaId:     mesaId     || undefined,
          observacao: observacao || undefined,
        }),
      });
      var d = await r.json();
      if (d.ok) {
        setSucesso(true);
        setData(toLocalDatetimeValue(3600_000));
        setPessoas(2);
        setMesaId("");
        setObservacao("");
        buscarAgendamentos();
      } else {
        setErro(d.error ?? "Erro ao criar reserva");
      }
    } catch {
      setErro("Erro de conexão.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h1 className="text-2xl font-extrabold text-cb-marrom mb-6">Reservas de Mesa</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Formulário nova reserva */}
        <div className="bg-white border border-cb-marrom/10 rounded-2xl p-6 shadow-sm">
          <p className="font-extrabold text-cb-marrom mb-4">Nova reserva</p>

          {sucesso && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl
                            px-4 py-3 mb-4">
              ✓ Reserva enviada! Aguarde confirmação.
            </div>
          )}
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl
                            px-4 py-3 mb-4">
              {erro}
            </div>
          )}

          <form onSubmit={enviar} className="flex flex-col gap-4">
            {/* Nome e WhatsApp (read-only, pre-populated) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">Nome</label>
                <input
                  type="text"
                  value={clienteNome}
                  readOnly
                  className="border border-cb-marrom/20 rounded-xl px-3 py-2.5 text-sm text-cb-marrom
                             bg-cb-bege/50 cursor-default"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">WhatsApp</label>
                <input
                  type="text"
                  value={clienteWhatsapp ? `+${clienteWhatsapp}` : "—"}
                  readOnly
                  className="border border-cb-marrom/20 rounded-xl px-3 py-2.5 text-sm text-cb-marrom
                             bg-cb-bege/50 cursor-default"
                />
              </div>
            </div>

            {/* Data e hora */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">
                Data e horário
              </label>
              <input
                type="datetime-local"
                value={data}
                min={toLocalDatetimeValue()}
                onChange={function (e) { setData(e.target.value); }}
                required
                className="border border-cb-marrom/20 rounded-xl px-3 py-2.5 text-sm text-cb-marrom
                           bg-white focus:outline-none focus:border-cb-amber transition-colors"
              />
            </div>

            {/* Pessoas */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">
                Número de pessoas
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={function () { setPessoas(function (p) { return Math.max(1, p - 1); }); }}
                  className="w-9 h-9 rounded-full bg-cb-marrom/10 text-cb-marrom font-bold hover:bg-cb-marrom/20 transition-colors"
                >
                  −
                </button>
                <span className="font-extrabold text-cb-marrom text-xl w-8 text-center">{pessoas}</span>
                <button
                  type="button"
                  onClick={function () { setPessoas(function (p) { return Math.min(20, p + 1); }); }}
                  className="w-9 h-9 rounded-full bg-cb-amber text-white font-bold hover:bg-cb-amber/90 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Mesa preferida */}
            {mesas.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">
                  Mesa preferida <span className="normal-case font-normal">(opcional)</span>
                </label>
                <select
                  value={mesaId}
                  onChange={function (e) { setMesaId(e.target.value); }}
                  className="border border-cb-marrom/20 rounded-xl px-3 py-2.5 text-sm text-cb-marrom
                             bg-white focus:outline-none focus:border-cb-amber transition-colors"
                >
                  <option value="">Sem preferência</option>
                  {mesas.map(function (m) {
                    return (
                      <option key={m.id} value={m.id}>
                        {m.nome ?? `Mesa ${m.numero}`}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Observação */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-cb-marrom/60 uppercase tracking-wider">
                Observações <span className="normal-case font-normal">(opcional)</span>
              </label>
              <textarea
                value={observacao}
                onChange={function (e) { setObservacao(e.target.value); }}
                rows={2}
                placeholder="Ex: aniversário, cadeirinha para bebê..."
                className="border border-cb-marrom/20 rounded-xl px-3 py-2.5 text-sm text-cb-marrom
                           bg-white focus:outline-none focus:border-cb-amber transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-cb-marrom text-cb-bege font-extrabold py-3 rounded-2xl
                         hover:bg-cb-marrom/90 transition-colors disabled:opacity-60 mt-1"
            >
              {enviando ? "Enviando..." : "📅 Confirmar reserva"}
            </button>
          </form>
        </div>

        {/* Lista de reservas futuras */}
        <div>
          <p className="font-extrabold text-cb-marrom mb-3">Próximas reservas</p>

          {carregando ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-cb-amber border-t-transparent rounded-full animate-spin" />
            </div>
          ) : agendamentos.length === 0 ? (
            <div className="bg-cb-bege/50 rounded-2xl p-6 text-center text-cb-marrom/40 text-sm">
              Nenhuma reserva futura
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {agendamentos.map(function (ag) {
                var dataFmt = new Date(ag.data).toLocaleString("pt-BR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div key={ag.id}
                       className="bg-white border border-cb-marrom/10 rounded-2xl p-4 shadow-sm">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-bold text-cb-marrom text-sm capitalize">{dataFmt}</p>
                        <p className="text-cb-marrom/50 text-xs mt-0.5">
                          {ag.pessoas} {ag.pessoas === 1 ? "pessoa" : "pessoas"}
                          {ag.duracao !== 60 && ` • ${ag.duracao} min`}
                          {ag.mesa && ` • ${ag.mesa.nome ?? `Mesa ${ag.mesa.numero}`}`}
                        </p>
                        {ag.observacao && (
                          <p className="text-cb-marrom/40 text-xs italic mt-0.5">"{ag.observacao}"</p>
                        )}
                      </div>
                      <span className={
                        "text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 " +
                        (STATUS_COR[ag.status] ?? "text-cb-marrom/50 bg-cb-bege border-cb-marrom/20")
                      }>
                        {STATUS_LABEL[ag.status] ?? ag.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
