'use client';

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
  origem?: string; // Origem do Pedido: APP/WHATSAPP = online, demais = presencial
}

export const printCupom = async (
  cupom: DadosCupom
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch('http://localhost:9100/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Sem origem informada = chamada do totem, portanto presencial
      body: JSON.stringify({ origem: 'TOTEM', ...cupom }),
      signal: AbortSignal.timeout(5000),
    });
    const result = await response.json();
    return { success: result.success };
  } catch (err: any) {
    console.warn('[PRINT] Servidor local não disponível:', err?.message);
    return { success: false, error: err?.message };
  }
};
