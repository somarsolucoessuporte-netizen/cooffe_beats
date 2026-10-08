import type { Metadata } from "next";
import WebNavbar from "@/components/web/WebNavbar";
import MobileBottomNav from "@/components/web/MobileBottomNav";
import WebRodape from "@/components/web/WebRodape";
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
        <WebRodape />
        {/* Navegação inferior — apenas mobile */}
        <MobileBottomNav />
      </div>
    </WebCarrinhoProvider>
  );
}
