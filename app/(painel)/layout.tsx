import type { Metadata } from "next";
import PainelSidebar from "@/components/painel/PainelSidebar";
import SessionProviderWrapper from "@/components/painel/SessionProviderWrapper";
import { ConfirmacaoProvider } from "@/components/painel/Confirmacao";

export const metadata: Metadata = {
  title: "Coffee & Beats — Painel",
};

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProviderWrapper>
      <div className="h-full flex bg-cb-bege text-cb-marrom">
        <PainelSidebar />
        <main className="flex-1 overflow-auto">
          <ConfirmacaoProvider>{children}</ConfirmacaoProvider>
        </main>
      </div>
    </SessionProviderWrapper>
  );
}
