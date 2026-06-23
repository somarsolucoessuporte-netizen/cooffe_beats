"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Estado = "aguardando" | "confirmado" | "expirado" | "erro";

function ConfirmacaoConteudo() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const sessaoId     = searchParams.get("sessao") ?? "";

  const [estado,      setEstado]      = useState<Estado>("aguardando");
  const [tentativas,  setTentativas]  = useState(0);

  const MAX_TENTATIVAS = 15; // 15 × 2s = 30s

  useEffect(function () {
    if (!sessaoId) { setEstado("erro"); return; }

    async function verificar() {
      try {
        var r = await fetch(`/api/web/pagamento/sumup/status?sessao=${sessaoId}`);
        var d = await r.json();

        if (!d.ok) { setEstado("erro"); return true; }

        if (d.data?.pedidoId) {
          setEstado("confirmado");
          router.replace(`/web/pedido/${d.data.pedidoId}`);
          return true; // para o polling
        }

        if (d.data?.expirado) { setEstado("expirado"); return true; }

        return false;
      } catch {
        return false;
      }
    }

    // Primeira verificação imediata
    verificar();

    var count = 0;
    var interval = setInterval(async function () {
      count++;
      var parar = await verificar();
      if (parar || count >= MAX_TENTATIVAS) {
        clearInterval(interval);
        if (count >= MAX_TENTATIVAS) setEstado("expirado");
      }
      setTentativas(count);
    }, 2000);

    return function () { clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessaoId]);

  // Confirmado → redireciona automaticamente (useEffect acima)
  // Mostra loading enquanto aguarda
  return (
    <div className="max-w-sm mx-auto px-4 py-16 flex flex-col items-center gap-6 text-center">

      {/* Spinner */}
      {estado === "aguardando" && (
        <>
          <div className="w-16 h-16 border-4 border-cb-amber border-t-transparent rounded-full animate-spin" />
          <div>
            <h1 className="text-xl font-extrabold text-cb-marrom">Confirmando seu pedido</h1>
            <p className="text-cb-marrom/50 text-sm mt-2">
              Pagamento recebido! Aguardando confirmação do SumUp...
            </p>
            <p className="text-cb-marrom/30 text-xs mt-4">
              {Math.max(0, MAX_TENTATIVAS - tentativas) * 2}s restantes
            </p>
          </div>
        </>
      )}

      {/* Sucesso (breve, antes do redirect) */}
      {estado === "confirmado" && (
        <>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl">
            ✓
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-cb-marrom">Pedido confirmado!</h1>
            <p className="text-cb-marrom/50 text-sm mt-2">Redirecionando...</p>
          </div>
        </>
      )}

      {/* Expirado / aguardando webhook */}
      {estado === "expirado" && (
        <>
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-3xl">
            ⏳
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-cb-marrom">Pagamento recebido!</h1>
            <p className="text-cb-marrom/60 text-sm mt-2 leading-relaxed">
              Seu pagamento foi processado. O pedido está sendo confirmado — pode levar alguns instantes.
            </p>
            <p className="text-cb-marrom/40 text-xs mt-3">
              Acesse <strong>Minha Conta → Pedidos</strong> para acompanhar.
            </p>
          </div>
          <Link
            href="/web/conta"
            className="bg-cb-marrom text-cb-bege font-bold px-8 py-3 rounded-2xl
                       hover:bg-cb-marrom/90 transition-colors"
          >
            Ver Minha Conta
          </Link>
        </>
      )}

      {/* Erro */}
      {estado === "erro" && (
        <>
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-3xl">
            ✕
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-cb-marrom">Algo deu errado</h1>
            <p className="text-cb-marrom/50 text-sm mt-2">
              Não foi possível confirmar o pagamento. Verifique sua conta ou tente novamente.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/web/carrinho" className="border-2 border-cb-marrom text-cb-marrom font-bold
                                                   px-5 py-2.5 rounded-2xl text-sm hover:bg-cb-bege transition-colors">
              Voltar ao carrinho
            </Link>
            <Link href="/web/conta" className="bg-cb-amber text-white font-bold px-5 py-2.5 rounded-2xl
                                               text-sm hover:bg-cb-amber/90 transition-colors">
              Minha conta
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function ConfirmacaoPage() {
  return (
    <Suspense fallback={
      <div className="max-w-sm mx-auto px-4 py-16 flex justify-center">
        <div className="w-10 h-10 border-4 border-cb-amber border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ConfirmacaoConteudo />
    </Suspense>
  );
}
