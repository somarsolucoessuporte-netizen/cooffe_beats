"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { playClick } from "@/lib/sounds";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

function formatarWhatsApp(valor: string): string {
  var nums = valor.replace(/\D/g, "").slice(0, 11);
  if (nums.length <= 2)  return "(" + nums;
  if (nums.length <= 7)  return "(" + nums.slice(0, 2) + ") " + nums.slice(2);
  if (nums.length <= 11) return "(" + nums.slice(0, 2) + ") " + nums.slice(2, 7) + "-" + nums.slice(7);
  return "(" + nums.slice(0, 2) + ") " + nums.slice(2, 7) + "-" + nums.slice(7, 11);
}

export default function MesaPage({ params }: { params: Promise<{ mesaId: string }> }) {
  const { mesaId } = use(params);
  const router = useRouter();

  const [mesa, setMesa]     = useState<{ numero: number; nome?: string } | null>(null);
  const [nome, setNome]     = useState("");
  const [wpp, setWpp]       = useState("");
  const [erro, setErro]     = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(function() {
    // Busca dados da mesa
    fetch("/api/admin/mesas/" + mesaId + "/info")
      .then(function(r) { return r.json(); })
      .then(function(d) { if (d.ok) setMesa(d.data); })
      .catch(function() {});
  }, [mesaId]);

  function pular() {
    playClick();
    try { sessionStorage.setItem("mesaId", mesaId); } catch(e) {}
    router.push("/cardapio");
  }

  async function confirmar() {
    setErro("");
    var nomeT = nome.trim();
    var nums  = wpp.replace(/\D/g, "");

    if (!nomeT) { setErro("Por favor, informe seu nome."); return; }
    if (nums.length < 10) { setErro("WhatsApp inválido."); return; }

    var wppInternacional = "55" + nums;
    setSalvando(true);

    try {
      var r = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaId: EMPRESA_ID, nome: nomeT, whatsapp: wppInternacional }),
      });
      var d = await r.json();
      if (d.ok) {
        playClick();
        try {
          sessionStorage.setItem("clienteId",   d.data.id);
          sessionStorage.setItem("clienteNome", d.data.nome);
          sessionStorage.setItem("clienteWpp",  d.data.whatsapp);
          sessionStorage.setItem("mesaId",      mesaId);
        } catch(e) {}
        router.push("/cardapio");
      } else {
        setErro(d.error ?? "Erro ao salvar.");
      }
    } catch(e) {
      setErro("Sem conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-10"
      style={{ background: "#F6F0E5" }}
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Coffee & Beats" className="w-24 h-24 object-contain" />

        {/* Mesa */}
        <div className="text-center">
          <div className="bg-cb-marrom text-cb-bege rounded-2xl px-6 py-3 inline-block mb-3">
            <span className="text-3xl font-extrabold">
              {mesa ? (mesa.nome ?? `Mesa ${mesa.numero}`) : "Mesa"}
            </span>
          </div>
          <p className="text-cb-marrom/60">Coffee & Beats</p>
          <p className="text-cb-marrom/50 text-sm mt-1">
            Identifique-se para fazer seu pedido
          </p>
        </div>

        {/* Campos */}
        <div className="w-full flex flex-col gap-3">
          <input
            type="text"
            inputMode="text"
            autoComplete="given-name"
            placeholder="Seu nome"
            value={nome}
            onChange={function(e) { setNome(e.target.value); setErro(""); }}
            className="w-full border-2 border-cb-marrom/20 rounded-2xl px-5 py-4 text-cb-marrom
                       text-lg font-medium bg-white focus:outline-none focus:border-cb-amber
                       placeholder:text-cb-marrom/30 transition-colors"
          />
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="WhatsApp: (00) 90000-0000"
            value={wpp}
            onChange={function(e) { setWpp(formatarWhatsApp(e.target.value)); setErro(""); }}
            className="w-full border-2 border-cb-marrom/20 rounded-2xl px-5 py-4 text-cb-marrom
                       text-lg font-medium bg-white focus:outline-none focus:border-cb-amber
                       placeholder:text-cb-marrom/30 transition-colors"
          />
          {erro && <p className="text-red-500 text-sm text-center">{erro}</p>}
        </div>

        <button
          onClick={confirmar}
          disabled={salvando}
          className="w-full bg-cb-marrom text-cb-bege font-extrabold text-xl
                     py-5 rounded-2xl disabled:opacity-60 transition-opacity
                     active:scale-95"
        >
          {salvando ? "Salvando..." : "FAZER PEDIDO"}
        </button>

        <button
          onClick={pular}
          className="text-cb-marrom/40 text-sm hover:text-cb-marrom/70 transition-colors underline"
        >
          Continuar sem identificar
        </button>
      </div>
    </div>
  );
}
