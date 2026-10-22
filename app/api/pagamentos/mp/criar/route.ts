import { NextRequest, NextResponse } from "next/server";
import { obterDevicePoint, criarPagamentoPoint, cancelarPagamentoPoint } from "@/lib/mercadopago";
import { reconciliarPagamentoMp, type PayloadMp } from "@/lib/mp-pagamento";
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
    // Sem tipo definido o cliente escolhe PIX, crédito ou débito na própria Point;
    // gravamos o botão escolhido no totem e o webhook corrige com o tipo real ao aprovar.
    const metodoPagamento: MetodoPagamento =
      metodo === "PIX"           ? "PIX" :
      metodo === "CARTAO_DEBITO" ? "CARTAO_DEBITO" : "CARTAO_CREDITO";

    const deviceId = await obterDevicePoint();
    await liberarPointDeCobrancasAnteriores(deviceId, pedidoId);
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

/**
 * Cobrança anterior ainda aberta na mesma Point (totem recarregado, cancelamento
 * que falhou...) faz a maquininha recusar ou confundir a nova. Cancela as intenções
 * pendentes de outros pedidos; se a Point recusar o cancelamento (já foi paga ou
 * está em processamento), reconsulta o status em vez de cancelar o pedido.
 */
async function liberarPointDeCobrancasAnteriores(deviceId: string, pedidoIdAtual: string) {
  const pendentes = await prisma.pagamento.findMany({
    where: {
      status:   "PENDENTE",
      pedidoId: { not: pedidoIdAtual },
      criadoEm: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      payload:  { path: ["provider"], equals: "mercadopago" },
    },
    select: { id: true, pedidoId: true, referencia: true, payload: true },
  });

  for (const p of pendentes) {
    const mp = p.payload as PayloadMp | null;
    if (!mp?.paymentIntentId || mp.deviceId !== deviceId) continue;

    try {
      await cancelarPagamentoPoint(deviceId, mp.paymentIntentId);
    } catch (e) {
      console.warn("[MP criar] Point não cancelou intenção anterior:", e instanceof Error ? e.message : e);
      await reconciliarPagamentoMp(p).catch(() => {});
      continue;
    }

    await prisma.pagamento.updateMany({ where: { id: p.id, status: "PENDENTE" }, data: { status: "CANCELADO" } });
    await prisma.pedido.updateMany({
      where: { id: p.pedidoId, status: "AGUARDANDO_PAGAMENTO" },
      data:  { status: "CANCELADO" },
    });
  }
}
