import { NextRequest, NextResponse } from "next/server";
import { criarPixQRCode, cancelarOrderMp } from "@/lib/mercadopago";
import { prisma } from "@/lib/prisma";
import { protegerPedido } from "@/lib/dividir-conta/guards";

/**
 * POST /api/pagamentos/mp/pix-qr
 * QR Pix dinâmico exibido na tela do totem — caminho principal do Pix (a Point não oferece Pix).
 * O valor vem do pedido gravado no banco (nunca do cliente): o `valor` do body é ignorado.
 *
 * Não depende da cobrança da Point: grava o Pagamento (referência + pixOrderId) aqui mesmo, para o
 * webhook/polling fecharem o pedido mesmo que a maquineta esteja offline. /mp/criar, que roda em
 * paralelo, atualiza o mesmo registro em vez de criar outro.
 */
export async function POST(req: NextRequest) {
  try {
    const { pedidoId, referencia, descricao } = await req.json();
    if (!pedidoId || !referencia) {
      return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
    }

    const bloqueio = await protegerPedido(pedidoId);
    if (bloqueio) return bloqueio;

    const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) {
      return NextResponse.json({ ok: false, error: "Pedido não encontrado" }, { status: 404 });
    }
    if (pedido.status !== "AGUARDANDO_PAGAMENTO") {
      return NextResponse.json({ ok: false, error: "Pedido não está aguardando pagamento" }, { status: 409 });
    }

    const valor = Number(pedido.total);
    const { orderId, qrData } = await criarPixQRCode({
      valor,
      referencia: String(referencia),
      descricao:  descricao ?? `Pedido ${pedido.senha}`,
    });

    // Guarda o orderId (cancelamento cruzado e polling). Falha aqui não impede o QR de aparecer.
    try {
      const anterior = await guardarOrderId(pedidoId, String(referencia), valor, orderId);
      // "Tentar novamente" gera outra order: a anterior não pode mais ser paga
      if (anterior && anterior !== orderId) void cancelarOrderMp(anterior);
    } catch (e) {
      console.error("[MP pix-qr] não guardou orderId", orderId, e instanceof Error ? e.message : e);
    }

    return NextResponse.json({ ok: true, orderId, qrData });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gerar Pix QR";
    console.error("[MP pix-qr]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** Cria o Pagamento PENDENTE ou atualiza o existente (criado em paralelo por /mp/criar). Retorna o orderId anterior. */
async function guardarOrderId(pedidoId: string, referencia: string, valor: number, orderId: string): Promise<string | null> {
  const existente = await prisma.pagamento.findUnique({ where: { pedidoId }, select: { status: true, pixOrderId: true } });
  if (existente) {
    if (existente.status === "PENDENTE") {
      await prisma.pagamento.updateMany({ where: { pedidoId, status: "PENDENTE" }, data: { pixOrderId: orderId, referencia } });
    }
    return existente.pixOrderId;
  }
  try {
    await prisma.pagamento.create({
      data: { pedidoId, referencia, status: "PENDENTE", valor, metodo: "PIX", pixOrderId: orderId, payload: { provider: "mercadopago", pixQr: true } },
    });
    return null;
  } catch (e) {
    // Corrida com /mp/criar (unique pedidoId): o outro lado criou primeiro
    if ((e as { code?: string }).code !== "P2002") throw e;
    await prisma.pagamento.updateMany({ where: { pedidoId, status: "PENDENTE" }, data: { pixOrderId: orderId, referencia } });
    return null;
  }
}
