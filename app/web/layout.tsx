import type { Metadata } from "next";
import WebNavbar from "@/components/web/WebNavbar";
import { WebCarrinhoProvider } from "@/contexts/WebCarrinhoContext";

export const metadata: Metadata = {
  title: "Coffee & Beats",
  description: "Peça online, acompanhe em tempo real e reserve sua mesa.",
};

export default function WebLayout({ children }: { children: React.ReactNode }) {
  return (
    <WebCarrinhoProvider>
      <div className="min-h-screen flex flex-col bg-white text-cb-marrom">
        <WebNavbar />
        <main className="flex-1">
          {children}
        </main>
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
      </div>
    </WebCarrinhoProvider>
  );
}
