"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

const EXPIRY_MS = 30 * 60 * 1000; // 30 minutos de inatividade

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

  useEffect(function() {
    // Não verificar na rota de identificação da mesa (evita loop)
    if (pathname.startsWith("/mesa")) return;

    var mesaId = ss("mesaId");
    if (!mesaId) return; // Totem sem mesa — sem sessão para gerenciar

    var expiryTs = Number(ss("mesaSessionExpiry"));

    function clearSession() {
      ssRemove("clienteId");
      ssRemove("clienteNome");
      ssRemove("clienteWpp");
      ssRemove("mesaSessionExpiry");
      // mantém mesaId para redirecionar corretamente
      router.replace("/mesa/" + mesaId);
    }

    if (expiryTs && Date.now() > expiryTs) {
      // Sessão expirada por inatividade
      clearSession();
      return;
    }

    // Sessão válida: renovar expiry a cada mudança de rota
    ssSet("mesaSessionExpiry", String(Date.now() + EXPIRY_MS));

    // Timer: se o cliente ficar parado na mesma tela por 30 min, expirar
    var timer = setTimeout(function() {
      if (ss("mesaId") === mesaId) clearSession();
    }, EXPIRY_MS);

    return function() { clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
