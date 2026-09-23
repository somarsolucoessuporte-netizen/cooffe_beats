import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { notificarWhatsApp } from "@/lib/notificar-whatsapp";

const includePedido = {
  itens: {
    include: {
      produto: true,
      adicionais: { include: { adicional: true } },
    },
  },
  pagamento: true,
} as const;

/**
 * Efeitos colaterais de um pedido que entrou na fila de preparo:
 * broadcast `pedido:novo` (KDS/painel), estatística e WhatsApp do cliente,
 * baixa de estoque. Chamado na criação (pedidos que já nascem RECEBIDO) ou
 * quando um pedido AGUARDANDO_PAGAMENTO do totem tem o pagamento aprovado.
 */
export async function efeitosPedidoNaFila(pedidoId: string) {
  const pedido = await prisma.pedido.findUnique({
    where:   { id: pedidoId },
    include: includePedido,
  });
  if (!pedido) return;

  if (pedido.clienteId) {
    prisma.cliente.update({
      where: { id: pedido.clienteId },
      data:  { totalGasto: { increment: Number(pedido.total) } },
    }).catch(() => {});

    prisma.cliente.findUnique({ where: { id: pedido.clienteId }, select: { nome: true, whatsapp: true } })
      .then(function(cliente) {
        if (!cliente?.whatsapp) return;
        notificarWhatsApp({
          whatsapp: cliente.whatsapp,
          tipo: "PEDIDO_CONFIRMADO",
          cliente: { nome: cliente.nome },
          pedido: {
            senha: pedido.senha,
            itens: pedido.itens.map(function(i) { return { nome: i.produto.nome, quantidade: i.quantidade }; }),
            total: Number(pedido.total),
          },
        });
      })
      .catch(function() {});
  }

  await supabaseAdmin.channel(`empresa-${pedido.empresaId}`).send({
    type:    "broadcast",
    event:   "pedido:novo",
    payload: pedido,
  });

  // Baixa automática de estoque — fire-and-forget, não bloqueia a resposta
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  fetch(`${baseUrl}/api/admin/estoque/baixa-automatica`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ pedidoId: pedido.id }),
  }).catch(function () {});
}

/**
 * Marca o pedido como pago. Se ele estava AGUARDANDO_PAGAMENTO (totem PIX/cartão),
 * passa para RECEBIDO e só então entra no KDS. Idempotente: a transição de status
 * é condicional, então webhook + confirmação manual simultâneos não duplicam
 * broadcast/estoque.
 */
export async function liberarPedidoPago(pedidoId: string) {
  const transicao = await prisma.pedido.updateMany({
    where: { id: pedidoId, status: "AGUARDANDO_PAGAMENTO" },
    data:  { status: "RECEBIDO", pago: true },
  });

  if (transicao.count > 0) {
    await efeitosPedidoNaFila(pedidoId);
    return;
  }

  // Pedido que já estava na fila (fluxo antigo / outros canais): só marca como pago
  await prisma.pedido.update({ where: { id: pedidoId }, data: { pago: true } });
}
