import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { CarrinhoProvider } from "@/contexts/CarrinhoContext";
import { TotemModoProvider } from "@/contexts/TotemModoContext";
import BotaoCarrinhoFlutuante from "@/components/totem/BotaoCarrinhoFlutuante";
import SessaoMesaGuard from "@/components/totem/SessaoMesaGuard";
import DispositivoOverride from "@/components/totem/DispositivoOverride";
import { COOKIE_DISPOSITIVO, ehCelular } from "@/lib/dispositivo";

export const metadata: Metadata = {
  title: "Coffee & Beats — Totem",
};

export default async function TotemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Detecção no servidor (User-Agent + cookie de override) — evita depender de largura/cache do PWA
  const ua     = (await headers()).get("user-agent") ?? "";
  const cookie = (await cookies()).get(COOKIE_DISPOSITIVO)?.value;
  const mobile = ehCelular(ua, cookie);

  return (
    <TotemModoProvider mobile={mobile}>
      <CarrinhoProvider>
        <div
          className={
            mobile
              // Celular: altura dinâmica (barra do navegador) e rolagem liberada
              ? "h-dvh w-full bg-cb-bege text-cb-marrom font-sans"
              : "h-screen w-screen overflow-hidden bg-cb-bege text-cb-marrom font-sans"
          }
        >
          <DispositivoOverride />
          <SessaoMesaGuard />
          {children}
          <BotaoCarrinhoFlutuante />
        </div>
      </CarrinhoProvider>
    </TotemModoProvider>
  );
}
