"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useWebCarrinho } from "@/contexts/WebCarrinhoContext";
import { supabase } from "@/lib/supabase";

type Estado = "aguardando" | "confirmado" | "expirado" | "erro";

const INTERVALO_MS = 3000;

function ConfirmacaoConteudo() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const sessaoId     = searchParams.get("sessao") ?? "";
  // Checkout Pro devolve status=approved|pending|rejected|null (null = cliente voltou sem pagar)
  const statusMp     = searchParams.get("status");
  const naoPago      = statusMp === "rejected" || statusMp === "null";
  const pixPendente  = statusMp === "pending";
  const { limparCarrinho } = useWebCarrinho();

  const [estado, setEstado] = useState<Estado>("aguardando");
  const finalizado = useRef(false);

  useEffect(function () {
    if (!sessaoId || naoPago) { setEstado("erro"); return; }

    function confirmar(pedidoId: string) {
      if (finalizado.current) return;
      finalizado.current = true;
      setEstado("confirmado");
      limparCarrinho(); // Checkout Pro mantém o carrinho até o pagamento ser confirmado
      setTimeout(function () { router.replace(`/web/pedido/${pedidoId}`); }, 1800);
    }

    // Realtime: o webhook do Mercado Pago avisa assim que o PIX/cartão é aprovado
    var channel = supabase
      .channel(`checkout-${sessaoId}`)
      .on("broadcast", { event: "pagamento:confirmado" }, function (msg) {
        var payload = msg.payload as { pedidoId?: string };
        if (payload.pedidoId) confirmar(payload.pedidoId);
      })
      .subscribe();

    // Fallback: polling a cada 3s (também reconsulta o MP) até a sessão expirar
    async function verificar(): Promise<boolean> {
      if (finalizado.current) return true;
      try {
        var r = await fetch(`/api/web/pagamento/sumup/status?sessao=${sessaoId}`);
        var d = await r.json();
        if (!d.ok) { setEstado("erro"); return true; }
        if (d.data?.pedidoId) { confirmar(d.data.pedidoId); return true; }
        if (d.data?.expirado) { setEstado("expirado"); return true; }
        return false;
      } catch {
        return false;
      }
    }

    var interval: ReturnType<typeof setInterval> | undefined;
    verificar().then(function (parar) {
      if (parar) return;
      interval = setInterval(async function () {
        if (await verificar()) clearInterval(interval);
      }, INTERVALO_MS);
    });

    return function () {
      if (interval) clearInterval(interval);
      supabase.removeChannel(channel);
    };
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
            <h1 className="text-xl font-extrabold text-cb-marrom">
              {pixPendente ? "Aguardando pagamento do PIX" : "Confirmando seu pedido"}
            </h1>
            <p className="text-cb-marrom/50 text-sm mt-2 leading-relaxed">
              {pixPendente
                ? "Pague o PIX no app do seu banco. Esta tela atualiza sozinha assim que o pagamento for confirmado."
                : "Aguardando a confirmação do pagamento..."}
            </p>
          </div>
        </>
      )}

      {/* Sucesso (breve, antes do redirect) */}
      {estado === "confirmado" && (
        <>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl">
            ✅
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-cb-marrom">Pagamento confirmado!</h1>
            <p className="text-cb-marrom/60 text-sm mt-2">Seu pedido está sendo preparado.</p>
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
            <h1 className="text-xl font-extrabold text-cb-marrom">Prazo de pagamento encerrado</h1>
            <p className="text-cb-marrom/60 text-sm mt-2 leading-relaxed">
              Não recebemos a confirmação do pagamento a tempo. Se você já pagou, o pedido
              aparece na sua conta assim que o Mercado Pago confirmar.
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
              {naoPago
                ? "O pagamento não foi concluído. Seu carrinho continua salvo — tente novamente."
                : "Não foi possível confirmar o pagamento. Verifique sua conta ou tente novamente."}
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
