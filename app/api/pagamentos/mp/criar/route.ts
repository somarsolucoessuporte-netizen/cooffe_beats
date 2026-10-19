import { NextRequest, NextResponse } from "next/server";
import { obterDevicePoint, criarPagamentoPoint } from "@/lib/mercadopago";
import { prisma } from "@/lib/prisma";
import type { MetodoPagamento } from "@prisma/client";

/**
 * POST /api/pagamentos/mp/criar
 * Envia a cobrança do pedido para a maquininha Mercado Pago Point.
 * A confirmação chega pelo webhook (/api/pagamentos/mp/webhook).
 */
export async function POST(req: NextRequest) {
  try {
    const { pedidoId, descricao, referencia, metodo } = await req.json();

    if (!pedidoId || !referencia) {
      return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
    }

    const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) {
      return NextResponse.json({ ok: false, error: "Pedido não encontrado" }, { status: 404 });
    }

    // Valor cobrado vem do pedido gravado no banco, nunca do que o cliente envia.
    const valor = Number(pedido.total);
    // Sem tipo definido o cliente escolhe crédito/débito na própria Point;
    // registramos CREDITO por padrão (mesmo critério do fluxo SumUp).
    const metodoPagamento: MetodoPagamento = metodo === "CARTAO_DEBITO" ? "CARTAO_DEBITO" : "CARTAO_CREDITO";

    const deviceId = await obterDevicePoint();
    const intent   = await criarPagamentoPoint({
      valor,
      referencia,
      descricao: descricao ?? "",
      deviceId,
    });

    await prisma.pagamento.create({
      data: {
        pedidoId,
        referencia,
        status:  "PENDENTE",
        valor,
        metodo:  metodoPagamento,
        payload: { provider: "mercadopago", paymentIntentId: intent.id, deviceId },
      },
    });

    return NextResponse.json({
      ok:   true,
      data: {
        checkoutId: intent.id,
        readerId:   deviceId,
        metodo:     "MAQUININHA",
        status:     intent.state,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar pagamento";
    console.error("[MP criar]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
