import type { Metadata } from "next";
import PainelSidebar from "@/components/painel/PainelSidebar";
import SessionProviderWrapper from "@/components/painel/SessionProviderWrapper";

export const metadata: Metadata = {
  title: "Coffee & Beats — Painel",
};

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProviderWrapper>
      <div className="h-full flex bg-zinc-950 text-zinc-100">
        <PainelSidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </SessionProviderWrapper>
  );
}
