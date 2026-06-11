import type { Metadata } from "next";
import { CarrinhoProvider } from "@/contexts/CarrinhoContext";

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
      <div className="h-screen w-screen overflow-hidden bg-cb-espresso text-cb-cream font-sans">
        {children}
      </div>
    </CarrinhoProvider>
  );
}
