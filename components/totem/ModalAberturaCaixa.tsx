"use client";

import { useEffect, useRef, useState } from "react";
import { playClick } from "@/lib/sounds";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

// Máscara monetária brasileira: dígitos viram centavos ("1250" → "R$ 12,50")
function mascaraMoeda(valor: string): string {
  var nums = valor.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9);
  if (!nums) return "";
  var centavos = parseInt(nums, 10);
  return "R$ " + (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function valorEmReais(mascarado: string): number {
  var nums = mascarado.replace(/\D/g, "");
  return nums ? parseInt(nums, 10) / 100 : 0;
}

/**
 * Modal de abertura de caixa exibido no totem no primeiro acesso do dia.
 * Grava na mesma tabela `caixas` que o painel usa (POST /api/caixa/abrir, sem sessão).
 * Fechar (toque fora / ESC) não bloqueia o totem — quem chama decide o aviso.
 */
export default function ModalAberturaCaixa({ onAberto, onFechar }: {
  onAberto: () => void;
  onFechar: () => void;
}) {
  const [valor, setValor]       = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro]         = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(function() {
    inputRef.current?.focus();
  }, []);

  // ESC fecha sem abrir o caixa
  useEffect(function() {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return function() { window.removeEventListener("keydown", aoTeclar); };
  }, [onFechar]);

  async function abrir(valorAbertura: number) {
    if (salvando) return;
    playClick();
    setSalvando(true);
    setErro("");
    try {
      var r = await fetch("/api/caixa/abrir", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ empresaId: EMPRESA_ID, valorAbertura }),
      });
      var d = await r.json();
      // 409 = alguém já abriu pelo painel nesse meio tempo — segue normalmente
      if (d.ok || r.status === 409) {
        onAberto();
        return;
      }
      setErro(d.error ?? "Erro ao abrir caixa.");
    } catch(e) {
      setErro("Sem conexão. Tente novamente.");
    }
    setSalvando(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
      onClick={salvando ? undefined : onFechar}
    >
      <div
        className="bg-cb-bege rounded-2xl p-8 w-full max-w-md flex flex-col gap-5 shadow-xl animate-fadeIn"
        onClick={function(e) { e.stopPropagation(); }}
      >
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-cb-marrom">Bom dia! ☀️</h2>
          <p className="text-cb-marrom/70 text-lg mt-2">Informe o valor em caixa para iniciar o dia</p>
        </div>

        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          placeholder="R$ 0,00"
          value={valor}
          onChange={function(e) { setValor(mascaraMoeda(e.target.value)); setErro(""); }}
          onKeyDown={function(e) { if (e.key === "Enter") abrir(valorEmReais(valor)); }}
          className="w-full h-16 border-2 border-cb-marrom/20 rounded-2xl px-5 text-cb-marrom
                     text-2xl font-bold text-center bg-white focus:outline-none focus:border-cb-amber
                     placeholder:text-cb-marrom/30 transition-colors"
        />

        {erro && <p className="text-red-600 text-lg text-center font-medium">{erro}</p>}

        <button
          onClick={function() { abrir(valorEmReais(valor)); }}
          disabled={salvando}
          className="w-full h-14 bg-cb-marrom text-cb-bege font-bold text-lg rounded-2xl
                     touch-manipulation active:scale-95 disabled:opacity-60 transition-transform"
        >
          {salvando ? "Abrindo..." : "Abrir caixa e começar o dia"}
        </button>

        <button
          onClick={function() { abrir(0); }}
          disabled={salvando}
          className="w-full h-14 text-cb-marrom/60 font-medium text-lg rounded-2xl
                     touch-manipulation active:scale-95 disabled:opacity-60 underline underline-offset-4"
        >
          Abrir sem valor inicial (R$ 0,00)
        </button>
      </div>
    </div>
  );
}
