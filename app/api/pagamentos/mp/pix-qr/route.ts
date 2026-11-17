import { NextRequest, NextResponse } from "next/server";
import { criarPixQRCode } from "@/lib/mercadopago";
import { prisma } from "@/lib/prisma";
import { protegerPedido } from "@/lib/dividir-conta/guards";

/**
 * POST /api/pagamentos/mp/pix-qr
 * QR Pix dinâmico exibido na tela do totem, em paralelo à cobrança na Point.
 * O valor vem do pedido gravado no banco (nunca do cliente): o `valor` do body é ignorado.
 * A `referencia` deve ser a mesma enviada a /api/pagamentos/mp/criar — é por ela que o
 * webhook de orders fecha o Pagamento.
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

    const { orderId, qrData } = await criarPixQRCode({
      valor:      Number(pedido.total),
      referencia: String(referencia),
      descricao:  descricao ?? `Pedido ${pedido.id}`,
    });
    await guardarOrderId(String(referencia), orderId);
    return NextResponse.json({ ok: true, orderId, qrData });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gerar Pix QR";
    console.error("[MP pix-qr]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/**
 * Grava o orderId no Pagamento da mesma referência (usado para cancelar a order quando a
 * Point aprovar, ou o totem cancelar). O Pagamento é criado em paralelo por /mp/criar, então
 * espera ele aparecer por alguns segundos. Falha aqui não impede o QR de ser exibido.
 */
async function guardarOrderId(referencia: string, orderId: string) {
  try {
    for (let i = 0; i < 12; i++) {
      const r = await prisma.pagamento.updateMany({ where: { referencia }, data: { pixOrderId: orderId } });
      if (r.count > 0) return;
      await new Promise((ok) => setTimeout(ok, 500));
    }
    console.warn("[MP pix-qr] Pagamento não encontrado para guardar orderId:", referencia, orderId);
  } catch (e) {
    console.warn("[MP pix-qr] não guardou orderId:", e instanceof Error ? e.message : e);
  }
}
