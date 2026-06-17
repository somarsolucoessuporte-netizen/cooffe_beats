'use client';

export const isNativeApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!(window as any).Capacitor?.isNativePlatform?.();
};

const getSunmi = (): any => {
  return (window as any)?.Capacitor?.Plugins?.SunmiPrinter ?? null;
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
  via: 'CLIENTE' | 'COZINHA' | 'BARISTA';
}

export const printCupom = async (
  cupom: DadosCupom
): Promise<{ success: boolean; error?: string }> => {

  if (!isNativeApp()) {
    console.log('[SUNMI D2P-58] Simulado (browser):', cupom);
    return { success: true };
  }

  const P = getSunmi();
  if (!P) {
    console.warn('[SUNMI D2P-58] Plugin não encontrado.');
    return { success: false, error: 'Plugin SunmiPrinter não disponível' };
  }

  try {
    await P.enterPrinterBuffer({ clean: true });
    await P.setAlignment({ alignment: 'center' });
    await P.setBold({ enable: true });
    await P.setFontSize({ size: 28 });
    await P.printText({ text: 'COFFEE & BEATS\n' });
    await P.setBold({ enable: false });
    await P.setFontSize({ size: 22 });

    if (cupom.via !== 'CLIENTE') {
      await P.setBold({ enable: true });
      await P.printText({ text: `*** VIA ${cupom.via} ***\n` });
      await P.setBold({ enable: false });
    }

    await P.printText({ text: '================================\n' });
    await P.setAlignment({ alignment: 'left' });
    await P.setBold({ enable: true });
    await P.printText({ text: `Pedido: ${cupom.numeroPedido}\n` });
    await P.setBold({ enable: false });

    if (cupom.nomeCliente) {
      await P.printText({ text: `Cliente: ${cupom.nomeCliente}\n` });
    }

    const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' });
    await P.printText({ text: `Data: ${dataHora}\n` });
    await P.printText({ text: '--------------------------------\n' });

    for (const item of cupom.itens) {
      const nome = `${item.quantidade}x ${item.nome}`;
      const preco = item.preco != null ? `R$${item.preco.toFixed(2)}` : '';
      const espaco = preco
        ? ' '.repeat(Math.max(1, 32 - nome.length - preco.length))
        : '';
      await P.printText({ text: `${nome}${espaco}${preco}\n` });
      if (item.observacao) {
        await P.printText({ text: `  Obs: ${item.observacao}\n` });
      }
    }

    await P.printText({ text: '================================\n' });
    await P.setAlignment({ alignment: 'right' });
    await P.setBold({ enable: true });
    await P.setFontSize({ size: 26 });
    await P.printText({ text: `TOTAL: R$${cupom.total.toFixed(2)}\n` });
    await P.setBold({ enable: false });
    await P.setFontSize({ size: 22 });

    if (cupom.metodoPagamento) {
      await P.setAlignment({ alignment: 'left' });
      await P.printText({ text: `Pgto: ${cupom.metodoPagamento}\n` });
    }

    if (cupom.via === 'CLIENTE') {
      await P.setAlignment({ alignment: 'center' });
      await P.printText({ text: '\nObrigado pela preferência!\n' });
      await P.printText({ text: 'coffeebeats.somar.ia.br\n' });
    }

    await P.lineWrap({ lines: 4 });
    await P.exitPrinterBuffer({ commit: true });
    return { success: true };

  } catch (err: any) {
    console.error('[SUNMI D2P-58] Erro:', err);
    try { await P.exitPrinterBuffer({ commit: false }); } catch {}
    return { success: false, error: err?.message || 'Erro desconhecido' };
  }
};
