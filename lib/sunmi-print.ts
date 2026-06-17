import { Capacitor } from "@capacitor/core";
import { SunmiPrinter } from "@kduma-autoid/capacitor-sunmi-printer";

export const isNativeApp = (): boolean => {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
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
    await SunmiPrinter.enterPrinterBuffer({ clean: true });

    // === CABEÇALHO ===
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

    // === DADOS DO PEDIDO ===
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

    // === ITENS ===
    // Papel 58mm ≈ 32 caracteres por linha
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

    // === TOTAL ===
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

  } catch (err: unknown) {
    console.error("[SUNMI D2P-58] Erro ao imprimir:", err);
    try { await SunmiPrinter.exitPrinterBuffer({ commit: false }); } catch { /* silencioso */ }
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return { success: false, error: msg };
  }
};
