"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { playClick } from "@/lib/sounds";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

function formatarMoeda(valor: string): string {
  var nums = valor.replace(/\D/g, "");
  var num = (parseInt(nums || "0", 10) / 100).toFixed(2);
  return "R$ " + num.replace(".", ",");
}

export default function AberturaCaixa() {
  const router = useRouter();

  const [verificando, setVerificando] = useState(true);
  const [nome, setNome]     = useState("");
  const [troco, setTroco]   = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro]     = useState("");

  useEffect(function() {
    fetch("/api/caixa/status?empresaId=" + EMPRESA_ID)
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok && d.data.aberto) {
          router.replace("/");
          return;
        }
        setVerificando(false);
      })
      .catch(function() { setVerificando(false); });
  }, [router]);

  async function abrirCaixa() {
    setErro("");
    if (!nome.trim()) { setErro("Por favor, informe seu nome."); return; }

    var nums = troco.replace(/\D/g, "");
    var valorAbertura = nums ? parseInt(nums, 10) / 100 : 0;

    setSalvando(true);
    try {
      var r = await fetch("/api/caixa/abrir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId: EMPRESA_ID,
          operadorNome: nome.trim(),
          valorAbertura: valorAbertura,
        }),
      });
      var d = await r.json();
      if (d.ok) {
        playClick();
        router.push("/");
      } else {
        setErro(d.error ?? "Erro ao abrir caixa.");
      }
    } catch (e) {
      setErro("Sem conexão. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  function continuarSemAbrir() {
    playClick();
    router.push("/");
  }

  if (verificando) {
    return (
      <div
        className="h-screen w-screen flex items-center justify-center"
        style={{ background: "#F6F0E5" }}
      >
        <span className="text-cb-marrom/40">Verificando caixa...</span>
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center select-none px-8"
      style={{ background: "#F6F0E5" }}
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-6 animate-fadeIn">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Coffee & Beats" className="w-24 h-24 object-contain" />

        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-cb-marrom leading-tight">
            Bom dia! Vamos começar?
          </h1>
          <p className="text-cb-marrom/60 text-base mt-1">
            Abra o caixa do dia para iniciar os pedidos.
          </p>
        </div>

        <div className="w-full flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-cb-marrom/70 pl-1">Seu nome</label>
            <input
              type="text"
              inputMode="text"
              autoComplete="given-name"
              placeholder="Ex: Maria"
              value={nome}
              onChange={function(e) { setNome(e.target.value); setErro(""); }}
              className="w-full border-2 border-cb-marrom/20 rounded-2xl px-5 py-4 text-cb-marrom
                         text-lg font-medium bg-white focus:outline-none focus:border-cb-amber
                         placeholder:text-cb-marrom/30 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-cb-marrom/70 pl-1">Troco inicial (opcional)</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={troco}
              onChange={function(e) {
                setTroco(formatarMoeda(e.target.value));
                setErro("");
              }}
              className="w-full border-2 border-cb-marrom/20 rounded-2xl px-5 py-4 text-cb-marrom
                         text-lg font-medium bg-white focus:outline-none focus:border-cb-amber
                         placeholder:text-cb-marrom/30 transition-colors"
            />
          </div>

          {erro && (
            <p className="text-red-500 text-sm text-center font-medium">{erro}</p>
          )}
        </div>

        <button
          onClick={abrirCaixa}
          disabled={salvando}
          className="w-full bg-cb-marrom text-cb-bege font-extrabold text-xl
                     py-5 rounded-2xl touch-manipulation btn-totem
                     disabled:opacity-60 transition-opacity"
        >
          {salvando ? "Abrindo..." : "ABRIR CAIXA DO DIA"}
        </button>

        <div className="w-full flex flex-col items-center gap-2">
          <p className="text-cb-marrom/40 text-xs">── ou ──</p>
          <p className="text-cb-marrom/50 text-sm">Caixa já foi aberto hoje?</p>
          <button
            onClick={continuarSemAbrir}
            className="text-cb-marrom/60 text-sm hover:text-cb-marrom
                       underline underline-offset-2"
          >
            Continuar sem abrir
          </button>
        </div>
      </div>
    </div>
  );
}
