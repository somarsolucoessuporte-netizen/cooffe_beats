import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { liberarPedidoPago } from "@/lib/liberar-pedido";
import { protegerPedido } from "@/lib/dividir-conta/guards";
import { cancelarPagamentoPoint } from "@/lib/mercadopago";
import { PIX_CHAVE_CNPJ, PIX_COMPROVANTE } from "@/lib/pix-estatico";

const Schema = z.object({
  metodo: z.enum(["PIX", "CARTAO"]),
  // Pix estático pela chave CNPJ exibido na tela: o atendente confirma que o dinheiro caiu
  origem: z.literal("PIX_CNPJ").optional(),
});

/**
 * POST /api/pagamentos/confirmar-manual/[pedidoId]
 * Fallback manual enquanto a maquininha SumUp não recebe a cobrança pela API:
 * o cliente paga direto na maquininha e o atendente confirma no totem (confirmação dupla).
 * O pedido sai de AGUARDANDO_PAGAMENTO para RECEBIDO (entra no KDS) e o pagamento
 * fica APROVADO com `confirmadoManualmente`. Se o webhook já aprovou, não altera nada.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pedidoId: string }> },
) {
  const { pedidoId } = await params;

  try {
    const bloqueio = await protegerPedido(pedidoId);
    if (bloqueio) return bloqueio;
    const validacao = Schema.safeParse(await req.json().catch(() => null));
    if (!validacao.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
    }
    const { metodo, origem } = validacao.data;
    const pixCnpj = origem === "PIX_CNPJ";

    const pedido = await prisma.pedido.findUnique({
      where:  { id: pedidoId },
      select: { status: true, total: true, pagamento: { select: { status: true, payload: true } } },
    });

    if (!pedido) {
      return NextResponse.json({ ok: false, error: "Pedido não encontrado" }, { status: 404 });
    }

    if (pedido.pagamento?.status === "APROVADO") {
      return NextResponse.json({ ok: true, jaAprovado: true });
    }

    if (pedido.status === "CANCELADO" || (pedido.pagamento && pedido.pagamento.status !== "PENDENTE")) {
      return NextResponse.json(
        { ok: false, error: "Pagamento não pode ser confirmado (pedido cancelado ou pagamento recusado)" },
        { status: 409 },
      );
    }

    // Registro para conferência no fim do dia; preserva a intenção da Point para cancelá-la em seguida
    const payloadAnterior = (pedido.pagamento?.payload ?? null) as { paymentIntentId?: string; deviceId?: string; [k: string]: unknown } | null;
    const registroPix = {
      ...(payloadAnterior && typeof payloadAnterior === "object" ? payloadAnterior : {}),
      origem: "PIX_CNPJ_ESTATICO",
      observacao: PIX_COMPROVANTE,
      chavePix: PIX_CHAVE_CNPJ,
    };
    const dadosAprovacao = {
      status: "APROVADO" as const,
      paidAt: new Date(),
      confirmadoManualmente: true,
      ...(pixCnpj ? { metodo: "PIX" as const, payload: registroPix } : {}),
    };

    if (pedido.pagamento) {
      // Condicional em PENDENTE: se o webhook aprovar no meio, não sobrescreve
      await prisma.pagamento.updateMany({
        where: { pedidoId, status: "PENDENTE" },
        data:  dadosAprovacao,
      });
    } else {
      // Cobrança SumUp não chegou a ser criada — registra o pagamento aqui
      await prisma.pagamento.create({
        data: {
          pedidoId,
          metodo:     metodo === "PIX" ? "PIX" : "CARTAO_CREDITO",
          valor:      pedido.total,
          referencia: `MAN-${Date.now()}`,
          ...dadosAprovacao,
        },
      });
    }

    await liberarPedidoPago(pedidoId);

    // Pix recebido: a cobrança pendente na maquineta não pode mais ser paga (segundo plano, só loga erro)
    if (pixCnpj && payloadAnterior?.paymentIntentId && payloadAnterior.deviceId) {
      cancelarPagamentoPoint(payloadAnterior.deviceId, payloadAnterior.paymentIntentId)
        .catch((e) => console.warn("[Confirmar manual] Point não cancelou a intenção:", e instanceof Error ? e.message : e));
    }

    return NextResponse.json({ ok: true, jaAprovado: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao confirmar pagamento manualmente";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
