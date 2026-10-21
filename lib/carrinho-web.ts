import { prisma } from "@/lib/prisma";
import type { ItemSessao } from "@/lib/checkout-sessao";

export type ItemCarrinhoEntrada = {
  produtoId:   string;
  quantidade:  number;
  observacao?: string;
  adicionais?: { adicionalId: string }[];
};

export type CarrinhoCalculado = {
  itens:    (ItemSessao & { observacao?: string })[];
  subtotal: number;
  desconto: number;
  total:    number;
  cupomId:  string | null;
};

/**
 * Recalcula o carrinho do portal web com preços do banco — o navegador só informa
 * produto, quantidade e adicionais. Valida o cupom com as mesmas regras de
 * /api/cupons/validar. Retorna { erro } quando algo não está mais disponível.
 */
export async function calcularCarrinhoWeb(
  empresaId: string,
  entrada: ItemCarrinhoEntrada[],
  cupomId?: string,
): Promise<CarrinhoCalculado | { erro: string }> {
  const produtos = await prisma.produto.findMany({
    where:   { id: { in: entrada.map((i) => i.produtoId) }, empresaId, disponivel: true },
    include: { adicionais: { include: { adicional: true } } },
  });

  const itens: CarrinhoCalculado["itens"] = [];
  for (const item of entrada) {
    const produto = produtos.find((p) => p.id === item.produtoId);
    if (!produto) return { erro: "Um dos produtos não está mais disponível. Atualize o carrinho." };

    const adicionais = (item.adicionais ?? []).map(function (a) {
      const vinculo = produto.adicionais.find((pa) => pa.adicionalId === a.adicionalId && pa.adicional.ativo);
      return vinculo ? { adicionalId: a.adicionalId, preco: Number(vinculo.adicional.preco) } : null;
    });
    if (adicionais.some((a) => a === null)) return { erro: `Adicional indisponível em ${produto.nome}` };

    const precoAdicionais = adicionais.reduce((s, a) => s + a!.preco, 0);
    itens.push({
      produtoId:  produto.id,
      nome:       produto.nome,
      preco:      Number(produto.preco) + precoAdicionais,
      quantidade: item.quantidade,
      adicionais: adicionais as { adicionalId: string; preco: number }[],
      observacao: item.observacao,
    });
  }

  const subtotal = Math.round(itens.reduce((s, i) => s + i.preco * i.quantidade, 0) * 100) / 100;

  let desconto = 0;
  if (cupomId) {
    const cupom = await prisma.cupom.findUnique({ where: { id: cupomId } });
    const valido = cupom && cupom.ativo
      && (!cupom.validoAte || new Date() <= cupom.validoAte)
      && (cupom.usoMaximo === null || cupom.usoAtual < cupom.usoMaximo)
      && (cupom.pedidoMinimo === null || subtotal >= cupom.pedidoMinimo);
    if (!valido) return { erro: "Cupom inválido ou expirado. Remova e tente novamente." };
    desconto = cupom.tipo === "percentual" ? (subtotal * cupom.valor) / 100 : Math.min(cupom.valor, subtotal);
    desconto = Math.round(desconto * 100) / 100;
  }

  return {
    itens,
    subtotal,
    desconto,
    total:   Math.round(Math.max(0, subtotal - desconto) * 100) / 100,
    cupomId: desconto > 0 ? cupomId! : null,
  };
}
