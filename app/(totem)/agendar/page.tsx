"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { playClick } from "@/lib/sounds";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";
const HORARIOS   = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
                    "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30",
                    "16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30",
                    "20:00","20:30","21:00","21:30","22:00"];

function formatarWhatsApp(v: string): string {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 2)  return "(" + n;
  if (n.length <= 7)  return `(${n.slice(0,2)}) ${n.slice(2)}`;
  return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

export default function AgendarPage() {
  const router = useRouter();

  const [nome,       setNome]       = useState("");
  const [wpp,        setWpp]        = useState("");
  const [data,       setData]       = useState(hoje());
  const [horario,    setHorario]    = useState("");
  const [pessoas,    setPessoas]    = useState(2);
  const [observacao, setObservacao] = useState("");
  const [enviando,   setEnviando]   = useState(false);
  const [erro,       setErro]       = useState("");
  const [sucesso,    setSucesso]    = useState(false);

  async function confirmar() {
    setErro("");
    if (!nome.trim())   { setErro("Informe seu nome."); return; }
    const nums = wpp.replace(/\D/g, "");
    if (nums.length < 10) { setErro("WhatsApp inválido."); return; }
    if (!data)          { setErro("Selecione a data."); return; }
    if (!horario)       { setErro("Selecione o horário."); return; }

    setEnviando(true);
    try {
      const dataHora = new Date(`${data}T${horario}:00`).toISOString();
      const r = await fetch("/api/agendamentos", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          empresaId:   EMPRESA_ID,
          nomeCliente: nome.trim(),
          telefone:    "55" + nums,
          data:        dataHora,
          pessoas,
          observacao:  observacao.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        playClick();
        setSucesso(true);
        setTimeout(function() { router.push("/"); }, 6000);
      } else {
        setErro(d.error ?? "Erro ao agendar. Tente novamente.");
      }
    } catch {
      setErro("Sem conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (sucesso) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-8 px-8 text-center"
        style={{ background: "#F6F0E5" }}
      >
        <div className="flex flex-col items-center gap-4">
          <span className="text-7xl">📅</span>
          <p className="font-extrabold text-3xl text-cb-marrom">Agendado!</p>
          <p className="text-cb-marrom/60 text-lg max-w-sm leading-relaxed">
            Seu agendamento foi recebido. Em breve entraremos em contato pelo WhatsApp para confirmar.
          </p>
          <p className="text-cb-marrom/40 text-sm mt-2">Voltando em alguns segundos...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#F6F0E5" }}
    >
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-cb-marrom/10 bg-cb-bege shrink-0">
        <button
          onClick={function() { playClick(); router.push("/"); }}
          className="text-cb-marrom/60 text-sm touch-manipulation active:scale-95 transition-transform"
        >
          ← Voltar
        </button>
        <p className="font-extrabold text-cb-marrom text-lg">Agendar Mesa</p>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto totem-scroll p-6 flex flex-col gap-5 max-w-sm mx-auto w-full">
        {/* Nome */}
        <div>
          <label className="block text-sm font-bold text-cb-marrom/70 mb-2">Seu nome *</label>
          <input
            type="text" autoComplete="given-name"
            value={nome}
            onChange={function(e) { setNome(e.target.value); setErro(""); }}
            placeholder="Ex: João Silva"
            className="w-full border-2 border-cb-marrom/20 rounded-2xl px-5 py-4 text-cb-marrom
                       text-lg font-medium bg-white focus:outline-none focus:border-cb-amber
                       placeholder:text-cb-marrom/30"
          />
        </div>

        {/* WhatsApp */}
        <div>
          <label className="block text-sm font-bold text-cb-marrom/70 mb-2">WhatsApp *</label>
          <input
            type="tel" inputMode="numeric"
            value={wpp}
            onChange={function(e) { setWpp(formatarWhatsApp(e.target.value)); setErro(""); }}
            placeholder="(00) 90000-0000"
            className="w-full border-2 border-cb-marrom/20 rounded-2xl px-5 py-4 text-cb-marrom
                       text-lg font-medium bg-white focus:outline-none focus:border-cb-amber
                       placeholder:text-cb-marrom/30"
          />
        </div>

        {/* Data */}
        <div>
          <label className="block text-sm font-bold text-cb-marrom/70 mb-2">Data *</label>
          <input
            type="date"
            min={hoje()}
            value={data}
            onChange={function(e) { setData(e.target.value); setErro(""); }}
            className="w-full border-2 border-cb-marrom/20 rounded-2xl px-5 py-4 text-cb-marrom
                       text-lg font-medium bg-white focus:outline-none focus:border-cb-amber"
          />
        </div>

        {/* Horário */}
        <div>
          <label className="block text-sm font-bold text-cb-marrom/70 mb-2">Horário *</label>
          <div className="grid grid-cols-4 gap-2">
            {HORARIOS.map(function(h) {
              return (
                <button
                  key={h}
                  onClick={function() { playClick(); setHorario(h); setErro(""); }}
                  className={`py-3 rounded-xl text-sm font-bold touch-manipulation transition-colors ${
                    horario === h
                      ? "bg-cb-marrom text-cb-bege"
                      : "bg-white border border-cb-marrom/20 text-cb-marrom hover:border-cb-amber"
                  }`}
                >
                  {h}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pessoas */}
        <div>
          <label className="block text-sm font-bold text-cb-marrom/70 mb-2">Número de pessoas</label>
          <div className="flex items-center gap-4">
            <button
              onClick={function() { playClick(); setPessoas(function(p) { return Math.max(1, p - 1); }); }}
              className="w-12 h-12 rounded-full bg-cb-marrom/10 text-cb-marrom font-bold text-xl
                         touch-manipulation btn-totem"
            >
              −
            </button>
            <span className="text-3xl font-extrabold text-cb-marrom w-8 text-center">{pessoas}</span>
            <button
              onClick={function() { playClick(); setPessoas(function(p) { return Math.min(20, p + 1); }); }}
              className="w-12 h-12 rounded-full bg-cb-amber text-cb-bege font-bold text-xl
                         touch-manipulation btn-totem"
            >
              +
            </button>
          </div>
        </div>

        {/* Observação */}
        <div>
          <label className="block text-sm font-bold text-cb-marrom/70 mb-2">Observações</label>
          <textarea
            value={observacao}
            onChange={function(e) { setObservacao(e.target.value); }}
            placeholder="Alguma preferência ou necessidade especial?"
            rows={3}
            className="w-full border-2 border-cb-marrom/20 rounded-2xl px-5 py-4 text-cb-marrom
                       text-base font-medium bg-white focus:outline-none focus:border-cb-amber
                       placeholder:text-cb-marrom/30 resize-none"
          />
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3 text-red-600 text-sm text-center">
            {erro}
          </div>
        )}

        <button
          onClick={confirmar}
          disabled={enviando}
          className="w-full bg-cb-marrom text-cb-bege font-extrabold text-xl
                     py-5 rounded-2xl disabled:opacity-60 transition-opacity
                     active:scale-[0.98] touch-manipulation min-h-[72px]"
        >
          {enviando ? "Aguarde..." : "📅 CONFIRMAR AGENDAMENTO"}
        </button>

        <div className="h-4" />
      </div>
    </div>
  );
}
