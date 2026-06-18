import type { Metadata } from "next";
import { CarrinhoProvider } from "@/contexts/CarrinhoContext";
import BotaoCarrinhoFlutuante from "@/components/totem/BotaoCarrinhoFlutuante";
import SessaoMesaGuard from "@/components/totem/SessaoMesaGuard";

export const metadata: Metadata = {
  title: "Coffee & Beats — Totem",
};

export default function TotemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CarrinhoProvider>
      <div className="h-screen w-screen overflow-hidden bg-cb-bege text-cb-marrom font-sans">
        <SessaoMesaGuard />
        {children}
        <BotaoCarrinhoFlutuante />
      </div>
    </CarrinhoProvider>
  );
}
