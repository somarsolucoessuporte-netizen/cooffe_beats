"use client";

import { createContext, useContext } from "react";

// true quando o totem está aberto num celular (decidido no servidor pelo User-Agent)
const TotemModoContext = createContext(false);

export function TotemModoProvider({ mobile, children }: { mobile: boolean; children: React.ReactNode }) {
  return <TotemModoContext.Provider value={mobile}>{children}</TotemModoContext.Provider>;
}

export function useTotemMobile(): boolean {
  return useContext(TotemModoContext);
}
