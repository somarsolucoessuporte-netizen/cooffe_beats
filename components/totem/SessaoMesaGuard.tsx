"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCarrinho, ItemCarrinho } from "@/contexts/CarrinhoContext";

const EXPIRY_MS = 30 * 60 * 1000;
const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

function ss(key: string): string {
  try { return sessionStorage.getItem(key) ?? ""; } catch(e) { return ""; }
}
function ssSet(key: string, val: string) {
  try { sessionStorage.setItem(key, val); } catch(e) {}
}
function ssRemove(key: string) {
  try { sessionStorage.removeItem(key); } catch(e) {}
}

export default function SessaoMesaGuard() {
  const router   = useRouter();
  const pathname = usePathname();
  const { itens, totalValor } = useCarrinho();

  // Refs para valores atuais dentro de closures de timeout
  const itensRef = useRef<ItemCarrinho[]>(itens);
  const totalRef = useRef<number>(totalValor);
  useEffect(function() { itensRef.current = itens;      }, [itens]);
  useEffect(function() { totalRef.current = totalValor; }, [totalValor]);

  useEffect(function() {
    if (pathname.startsWith("/mesa")) return;

    var mesaId = ss("mesaId");
    if (!mesaId) return;

    var expiryTs = Number(ss("mesaSessionExpiry"));

    function salvarCarrinhoAbandonado() {
      var currentItens = itensRef.current;
      if (currentItens.length === 0) return;
      fetch("/api/carrinho-abandonado", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId:     EMPRESA_ID,
          mesaId,
          nomeCliente:   ss("clienteNome") || undefined,
          telefone:      ss("clienteWpp")  || undefined,
          itensJson:     currentItens,
          totalEstimado: totalRef.current,
        }),
      }).catch(function() {});
    }

    function clearSession() {
      salvarCarrinhoAbandonado();
      ssRemove("clienteId");
      ssRemove("clienteNome");
      ssRemove("clienteWpp");
      ssRemove("mesaSessionExpiry");
      ssRemove("cupomId");
      ssRemove("cupomDesconto");
      router.replace("/mesa/" + mesaId);
    }

    if (expiryTs && Date.now() > expiryTs) {
      clearSession();
      return;
    }

    ssSet("mesaSessionExpiry", String(Date.now() + EXPIRY_MS));

    var timer = setTimeout(function() {
      if (ss("mesaId") === mesaId) clearSession();
    }, EXPIRY_MS);

    return function() { clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
