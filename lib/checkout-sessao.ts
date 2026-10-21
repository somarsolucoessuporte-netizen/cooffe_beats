import type { MetodoPagamento, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";

/** Item gravado em CheckoutSessao.itensJson (preco = unitário já somando os adicionais). */
export type ItemSessao = {
  produtoId:   string;
  nome:        string;
  preco:       number;
  quantidade:  number;
  adicionais?: { adicionalId: string; preco: number }[];
};

/**
 * Pagamento online aprovado (SumUp ou Checkout Pro): cria o pedido da sessão,
 * já pago, registra o Pagamento e avisa o KDS. Idempotente — a sessão é
 * "reivindicada" dentro da transação, então webhooks repetidos não duplicam.
 * Retorna o id do pedido (criado agora ou antes) ou null se a sessão não existe.
 */
export async function criarPedidoDaSessao(sessaoId: string, pagamento: {
  metodo:  MetodoPagamento;
  payload: Prisma.InputJsonValue;
}): Promise<string | null> {
  const pedido = await prisma.$transaction(async function (tx) {
    const sessao = await tx.checkoutSessao.findUnique({ where: { id: sessaoId } });
    if (!sessao) return null;

    const reivindicada = await tx.checkoutSessao.updateMany({
      where: { id: sessaoId, status: { not: "PAGO" } },
      data:  { status: "PAGO" },
    });
    if (reivindicada.count === 0) return null; // já processada

    const config = await tx.configuracao.findUnique({ where: { empresaId: sessao.empresaId } });
    if (!config) throw new Error("Configuração não encontrada");

    const novaSenha = config.senhaAtual + 1;
    await tx.configuracao.update({ where: { empresaId: sessao.empresaId }, data: { senhaAtual: novaSenha } });
    const senha = `${config.prefixoSenha}-${novaSenha}`;

    const caixaAberto = await tx.caixa.findFirst({
      where:  { empresaId: sessao.empresaId, status: "ABERTO" },
      select: { id: true },
    });

    const itens    = sessao.itensJson as ItemSessao[];
    const total    = Number(sessao.total);
    const desconto = Number(sessao.valorDesconto ?? 0);

    if (sessao.cupomId) {
      // updateMany não lança se o cupom sumiu — erro dentro da transação a abortaria
      await tx.cupom.updateMany({ where: { id: sessao.cupomId }, data: { usoAtual: { increment: 1 } } });
    }

    const novoPedido = await tx.pedido.create({
      data: {
        empresaId:           sessao.empresaId,
        senha,
        status:              "RECEBIDO",
        origem:              "APP",
        subtotal:            total + desconto,
        total,
        clienteId:           sessao.clienteId,
        caixaId:             caixaAberto?.id ?? null,
        cupomId:             sessao.cupomId ?? null,
        valorDesconto:       desconto > 0 ? desconto : null,
        previsaoChegada:     sessao.previsaoChegada,
        pago:                true,
        pagamentoAntecipado: true,
        itens: {
          create: itens.map(function (item) {
            return {
              produtoId:  item.produtoId,
              quantidade: item.quantidade,
              precoUnit:  item.preco,
              precoTotal: item.preco * item.quantidade,
              adicionais: {
                create: (item.adicionais ?? []).map(function (a) {
                  return { adicionalId: a.adicionalId, preco: a.preco };
                }),
              },
            };
          }),
        },
      },
      include: { itens: { include: { produto: true, adicionais: { include: { adicional: true } } } } },
    });

    await tx.pagamento.create({
      data: {
        pedidoId:   novoPedido.id,
        metodo:     pagamento.metodo,
        status:     "APROVADO",
        valor:      total,
        referencia: sessao.id,
        payload:    pagamento.payload,
        paidAt:     new Date(),
      },
    });

    await tx.checkoutSessao.update({ where: { id: sessao.id }, data: { pedidoId: novoPedido.id } });

    await tx.cliente.updateMany({
      where: { id: sessao.clienteId },
      data:  { totalGasto: { increment: total } },
    });

    return novoPedido;
  });

  if (!pedido) {
    const sessao = await prisma.checkoutSessao.findUnique({ where: { id: sessaoId }, select: { pedidoId: true } });
    return sessao?.pedidoId ?? null;
  }

  // Broadcast para o KDS em tempo real
  await supabaseAdmin.channel(`empresa-${pedido.empresaId}`).send({
    type:    "broadcast",
    event:   "pedido:novo",
    payload: { ...pedido, pagamentoAntecipado: true },
  });

  return pedido.id;
}
