"use client";

import { usePathname } from "next/navigation";

// Rodapé do portal web — oculto no cardápio da mesa (/web/m)
export default function WebRodape() {
  const pathname = usePathname();
  if (pathname === "/web/m" || pathname.startsWith("/web/m/")) return null;

  return (
    <footer className="border-t border-cb-marrom/10 py-6 text-center">
      <p className="text-cb-marrom/30 text-xs">
        Coffee &amp; Beats &middot; Desenvolvido por{" "}
        <a
          href="https://somar.ia.br"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cb-marrom/50 hover:text-cb-marrom/70 transition-colors"
        >
          Somar Soluções Digitais
        </a>
      </p>
    </footer>
  );
}
