export const isNativeApp = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
};

export interface ItemCupom {
  nome: string;
  quantidade: number;
  preco?: number;
  observacao?: string;
}

export interface DadosCupom {
  numeroPedido: string;
  itens: ItemCupom[];
  total: number;
  subtotal?: number;
  nomeCliente?: string;
  metodoPagamento?: string;
  via: "CLIENTE" | "COZINHA" | "BARISTA";
}

export const printCupom = async (
  cupom: DadosCupom
): Promise<{ success: boolean; error?: string }> => {

  if (!isNativeApp()) {
    console.log("[SUNMI D2P-58] Impressão simulada (modo browser):", cupom);
    return { success: true };
  }

  try {
    const { SunmiPrinter } = await import("@kduma-autoid/capacitor-sunmi-printer");

    await SunmiPrinter.enterPrinterBuffer({ clean: true });

    await SunmiPrinter.setAlignment({ alignment: "center" });
    await SunmiPrinter.setBold({ enable: true });
    await SunmiPrinter.setFontSize({ size: 28 });
    await SunmiPrinter.printText({ text: "COFFEE & BEATS\n" });
    await SunmiPrinter.setBold({ enable: false });
    await SunmiPrinter.setFontSize({ size: 22 });

    if (cupom.via !== "CLIENTE") {
      await SunmiPrinter.setBold({ enable: true });
      await SunmiPrinter.printText({ text: `*** VIA ${cupom.via} ***\n` });
      await SunmiPrinter.setBold({ enable: false });
    }

    await SunmiPrinter.printText({ text: "================================\n" });
    await SunmiPrinter.setAlignment({ alignment: "left" });
    await SunmiPrinter.setBold({ enable: true });
    await SunmiPrinter.printText({ text: `Pedido: ${cupom.numeroPedido}\n` });
    await SunmiPrinter.setBold({ enable: false });

    if (cupom.nomeCliente) {
      await SunmiPrinter.printText({ text: `Cliente: ${cupom.nomeCliente}\n` });
    }

    const agora = new Date();
    const dataHora = agora.toLocaleString("pt-BR", { timeZone: "America/Fortaleza" });
    await SunmiPrinter.printText({ text: `Data: ${dataHora}\n` });
    await SunmiPrinter.printText({ text: "--------------------------------\n" });

    for (const item of cupom.itens) {
      const nome  = `${item.quantidade}x ${item.nome}`;
      const preco = item.preco != null ? `R$${item.preco.toFixed(2)}` : "";
      const espaco = preco
        ? " ".repeat(Math.max(1, 32 - nome.length - preco.length))
        : "";
      await SunmiPrinter.printText({ text: `${nome}${espaco}${preco}\n` });
      if (item.observacao) {
        await SunmiPrinter.printText({ text: `  Obs: ${item.observacao}\n` });
      }
    }

    await SunmiPrinter.printText({ text: "================================\n" });
    await SunmiPrinter.setAlignment({ alignment: "right" });
    await SunmiPrinter.setBold({ enable: true });
    await SunmiPrinter.setFontSize({ size: 26 });
    await SunmiPrinter.printText({ text: `TOTAL: R$${cupom.total.toFixed(2)}\n` });
    await SunmiPrinter.setBold({ enable: false });
    await SunmiPrinter.setFontSize({ size: 22 });

    if (cupom.metodoPagamento) {
      await SunmiPrinter.setAlignment({ alignment: "left" });
      await SunmiPrinter.printText({ text: `Pgto: ${cupom.metodoPagamento}\n` });
    }

    if (cupom.via === "CLIENTE") {
      await SunmiPrinter.setAlignment({ alignment: "center" });
      await SunmiPrinter.printText({ text: "\nObrigado pela preferência!\n" });
      await SunmiPrinter.printText({ text: "coffeebeats.somar.ia.br\n" });
    }

    await SunmiPrinter.lineWrap({ lines: 4 });
    await SunmiPrinter.exitPrinterBuffer({ commit: true });

    return { success: true };

  } catch (err: any) {
    console.error("[SUNMI D2P-58] Erro ao imprimir:", err);
    try {
      const { SunmiPrinter } = await import("@kduma-autoid/capacitor-sunmi-printer");
      await SunmiPrinter.exitPrinterBuffer({ commit: false });
    } catch { /* silencioso */ }
    return { success: false, error: err?.message || "Erro desconhecido" };
  }
};
