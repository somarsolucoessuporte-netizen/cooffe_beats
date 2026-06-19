"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { playClick } from "@/lib/sounds";
import { Suspense } from "react";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

function formatarWhatsApp(valor: string): string {
  var nums = valor.replace(/\D/g, "").slice(0, 11);
  if (nums.length <= 2)  return "(" + nums;
  if (nums.length <= 7)  return "(" + nums.slice(0, 2) + ") " + nums.slice(2);
  if (nums.length <= 11) return "(" + nums.slice(0, 2) + ") " + nums.slice(2, 7) + "-" + nums.slice(7);
  return "(" + nums.slice(0, 2) + ") " + nums.slice(2, 7) + "-" + nums.slice(7, 11);
}

function IdentificacaoConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mesaId = searchParams.get("mesa") ?? "";

  const [nome, setNome]       = useState("");
  const [wpp, setWpp]         = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro]       = useState("");
  const nomeRef = useRef<HTMLInputElement>(null);

  useEffect(function() {
    nomeRef.current?.focus();
  }, []);

  var destino = mesaId ? "/cardapio?mesa=" + mesaId : "/cardapio";

  function pular() {
    playClick();
    if (mesaId) {
      try { sessionStorage.setItem("mesaId", mesaId); } catch(e) {}
    }
    router.push(destino);
  }

  async function confirmar() {
    setErro("");
    var nomeT = nome.trim();
    var nums  = wpp.replace(/\D/g, "");

    if (!nomeT) { setErro("Por favor, informe seu nome."); return; }
    if (nums.length < 10) { setErro("WhatsApp inválido. Ex: (85) 99999-9999"); return; }

    // Formatar para padrão internacional Brasil (55 + DDD + número)
    var wppInternacional = nums.length === 11 ? "55" + nums : "55" + nums;

    setSalvando(true);
    try {
      var r = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId: EMPRESA_ID,
          nome: nomeT,
          whatsapp: wppInternacional,
        }),
      });
      var d = await r.json();
      if (d.ok) {
        playClick();
        try {
          sessionStorage.setItem("clienteId",   d.data.id);
          sessionStorage.setItem("clienteNome", d.data.nome);
          sessionStorage.setItem("clienteWpp",  d.data.whatsapp);
          if (mesaId) sessionStorage.setItem("mesaId", mesaId);
        } catch(e) {}
        router.push(destino);
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
      className="h-screen w-screen flex flex-col select-none"
      style={{ background: "#F6F0E5" }}
    >
      {/* Botão voltar */}
      <button
        onClick={function() { router.push("/"); }}
        className="absolute top-4 left-4 flex items-center gap-1.5 text-[#3B2415] touch-manipulation
                   active:scale-95 transition-transform p-2"
        title="Voltar"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M14 17L8 11L14 5" stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <div className="flex-1 flex flex-col items-center justify-center px-8">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 animate-fadeIn">
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Coffee & Beats" className="w-28 h-28 object-contain" />

        {/* Título */}
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-cb-marrom leading-tight">
            Bem-vindo!
          </h1>
          <p className="text-cb-marrom/60 text-base mt-1">
            Como podemos te chamar?
          </p>
        </div>

        {/* Campos */}
        <div className="w-full flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-cb-marrom/70 pl-1">Seu nome</label>
            <input
              ref={nomeRef}
              type="text"
              inputMode="text"
              autoComplete="given-name"
              placeholder="Ex: João Silva"
              value={nome}
              onChange={function(e) { setNome(e.target.value); setErro(""); }}
              onKeyDown={function(e) { if (e.key === "Enter") confirmar(); }}
              className="w-full border-2 border-cb-marrom/20 rounded-2xl px-5 py-4 text-cb-marrom
                         text-lg font-medium bg-white focus:outline-none focus:border-cb-amber
                         placeholder:text-cb-marrom/30 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-cb-marrom/70 pl-1">WhatsApp</label>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="(00) 90000-0000"
              value={wpp}
              onChange={function(e) {
                setWpp(formatarWhatsApp(e.target.value));
                setErro("");
              }}
              onKeyDown={function(e) { if (e.key === "Enter") confirmar(); }}
              className="w-full border-2 border-cb-marrom/20 rounded-2xl px-5 py-4 text-cb-marrom
                         text-lg font-medium bg-white focus:outline-none focus:border-cb-amber
                         placeholder:text-cb-marrom/30 transition-colors"
            />
          </div>

          {erro && (
            <p className="text-red-500 text-sm text-center font-medium">{erro}</p>
          )}
        </div>

        {/* Botão principal */}
        <button
          onClick={confirmar}
          disabled={salvando}
          className="w-full bg-cb-marrom text-cb-bege font-extrabold text-xl
                     py-5 rounded-2xl touch-manipulation btn-totem
                     disabled:opacity-60 transition-opacity"
        >
          {salvando ? "Salvando..." : "CONTINUAR"}
        </button>

        {/* Pular */}
        <button
          onClick={pular}
          className="text-cb-marrom/40 text-sm hover:text-cb-marrom/70 transition-colors
                     underline underline-offset-2"
        >
          Pular identificação
        </button>
      </div>
      </div>
    </div>
  );
}

export default function Identificacao() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center" style={{ background: "#F6F0E5" }}>
        <span className="text-cb-marrom/40">Carregando...</span>
      </div>
    }>
      <IdentificacaoConteudo />
    </Suspense>
  );
}
