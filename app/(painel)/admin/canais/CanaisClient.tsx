"use client";

import { useState } from "react";

interface Canal {
  id:    string;
  nome:  string;
  tipo:  string;
  ativo: boolean;
}

const ICONES: Record<string, string> = {
  "Totem":     "🖥️",
  "Mesa":      "🪑",
  "iFood":     "🛵",
  "99Food":    "🏍️",
  "Uber Eats": "🟢",
};

interface Props { canais: Canal[] }

export default function CanaisClient({ canais }: Props) {
  const [modalEmBreve, setModalEmBreve] = useState(false);
  const [canalModal, setCanalModal]     = useState<Canal | null>(null);

  function abrirModal(canal: Canal) {
    setCanalModal(canal);
    setModalEmBreve(true);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#3B2415]">Canais de Venda</h1>
        <p className="text-sm text-[#3B2415]/60 mt-0.5">
          Gerencie os canais de pedido — totem, mesa e integrações de delivery
        </p>
      </div>

      <div className="grid gap-4">
        {canais.map(function(canal) {
          const interno   = canal.tipo === "interno";
          const icone     = ICONES[canal.nome] ?? "📦";
          return (
            <div
              key={canal.id}
              className={`bg-white rounded-2xl border p-5 shadow-sm flex items-center gap-5
                          ${!interno ? "cursor-pointer hover:border-gray-300 transition-colors" : ""}
                          ${interno ? "border-[#C8853A]/30" : "border-gray-100"}`}
              onClick={!interno ? function() { abrirModal(canal); } : undefined}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0
                              ${interno ? "bg-[#C8853A]/10" : "bg-gray-50"}`}>
                {icone}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#3B2415] text-base">{canal.nome}</span>
                  {interno ? (
                    <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
                      ✅ Ativo
                    </span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">
                      🔒 Em breve
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#3B2415]/50 mt-0.5">
                  {interno
                    ? "Canal interno — pedidos feitos diretamente no totem"
                    : "Integração com plataforma de delivery externa"}
                </p>
              </div>

              {!interno && (
                <span className="text-gray-300 text-xl shrink-0">›</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Seção informativa */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-5">
        <p className="font-bold text-blue-800 mb-2">📋 Sobre integrações de delivery</p>
        <p className="text-sm text-blue-700 leading-relaxed">
          A estrutura técnica está pronta. Para ativar uma integração real (iFood, 99Food, Uber Eats),
          é necessário processo de homologação oficial com cada plataforma.{" "}
          <strong>Entre em contato com a Somar Soluções Digitais</strong> para iniciar o processo.
        </p>
        <p className="text-xs text-blue-500 mt-2">
          Ver: <code className="bg-blue-100 px-1 rounded">docs/INTEGRACAO_DELIVERY.md</code>
        </p>
      </div>

      {/* Modal Em breve */}
      {modalEmBreve && canalModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6"
          onClick={function() { setModalEmBreve(false); }}
        >
          <div
            className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
            onClick={function(e) { e.stopPropagation(); }}
          >
            <p className="text-5xl text-center mb-4">{ICONES[canalModal.nome] ?? "📦"}</p>
            <h2 className="font-extrabold text-xl text-[#3B2415] text-center mb-2">
              {canalModal.nome}
            </h2>
            <p className="text-sm text-[#3B2415]/60 text-center leading-relaxed">
              Esta integração requer homologação oficial com a plataforma.
              Entre em contato com a <strong>Somar.IA</strong> para iniciar o processo.
            </p>
            <div className="mt-6 bg-[#C8853A]/10 rounded-2xl p-4 text-center">
              <p className="text-xs text-[#C8853A] font-semibold">contato@somar.ia.br</p>
            </div>
            <button
              onClick={function() { setModalEmBreve(false); }}
              className="w-full mt-5 bg-[#3B2415] text-white font-bold py-3 rounded-xl hover:bg-[#2a1a0f]"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-8">Somar Soluções Digitais</p>
    </div>
  );
}
