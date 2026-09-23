import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { liberarPedidoPago } from "@/lib/liberar-pedido";

const Schema = z.object({
  pin:    z.string(),
  metodo: z.enum(["PIX", "CARTAO"]),
});

// PIN do atendente — padrão 1234 até existir tela de configuração
const PIN_CONFIRMACAO = process.env.PIN_CONFIRMACAO_MANUAL ?? "1234";

/**
 * POST /api/pagamentos/confirmar-manual/[pedidoId]
 * Fallback manual enquanto a maquininha SumUp não recebe a cobrança pela API:
 * o cliente paga direto na maquininha e o atendente confirma com PIN no totem.
 * O pedido sai de AGUARDANDO_PAGAMENTO para RECEBIDO (entra no KDS) e o pagamento
 * fica APROVADO com `confirmadoManualmente`. Se o webhook já aprovou, não altera nada.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pedidoId: string }> },
) {
  const { pedidoId } = await params;

  try {
    const validacao = Schema.safeParse(await req.json().catch(() => null));
    if (!validacao.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
    }
    const { pin, metodo } = validacao.data;

    if (pin !== PIN_CONFIRMACAO) {
      return NextResponse.json({ ok: false, error: "PIN incorreto" }, { status: 401 });
    }

    const pedido = await prisma.pedido.findUnique({
      where:  { id: pedidoId },
      select: { status: true, total: true, pagamento: { select: { status: true } } },
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

    const dadosAprovacao = {
      status: "APROVADO" as const,
      paidAt: new Date(),
      confirmadoManualmente: true,
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

    return NextResponse.json({ ok: true, jaAprovado: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao confirmar pagamento manualmente";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
