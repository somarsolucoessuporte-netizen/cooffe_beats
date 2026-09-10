import { NextRequest, NextResponse } from "next/server";
import { getReaders, enviarParaMaquininha, criarCheckout } from "@/lib/sumup";
import { prisma } from "@/lib/prisma";
import type { MetodoPagamento } from "@prisma/client";

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
    // MetodoPagamento não tem valor genérico "cartão" — o terminal só informa
    // PAID/SUCCESSFUL, não débito vs. crédito, então mapeamos para CREDITO por padrão.
    const metodoPagamento: MetodoPagamento = metodo === "PIX" ? "PIX" : "CARTAO_CREDITO";

    // Tentar maquininha física primeiro (PIX e cartão passam pela leitora)
    try {
      const readers      = await getReaders();
      const readerOnline = readers.find((r) => r.status === "online");

      if (readerOnline) {
        const checkout = await enviarParaMaquininha(
          readerOnline.id,
          valor,
          descricao ?? "",
          referencia,
        );
        await prisma.pagamento.create({
          data: {
            pedidoId,
            referencia,
            status: "PENDENTE",
            valor,
            metodo: metodoPagamento,
          },
        });
        return NextResponse.json({
          ok:   true,
          data: {
            checkoutId: checkout.id,
            readerId:   readerOnline.id,
            metodo:     "MAQUININHA",
            status:     checkout.status,
          },
        });
      }
      console.warn("[SumUp] Nenhum reader online — fallback para checkout web");
    } catch (e) {
      console.warn(
        "[SumUp] Erro ao buscar readers, fallback web:",
        e instanceof Error ? e.message : e,
      );
    }

    // Fallback: checkout web hospedado em pay.sumup.com
    const checkout    = await criarCheckout({ valor, descricao: descricao ?? "", referencia });
    const checkoutUrl =
      checkout.checkout_url ??
      `https://pay.sumup.com/b2c/${process.env.SUMUP_MERCHANT_CODE}?checkout_id=${checkout.id}`;

    await prisma.pagamento.create({
      data: {
        pedidoId,
        referencia,
        status: "PENDENTE",
        valor,
        metodo: metodoPagamento,
      },
    });

    return NextResponse.json({
      ok:   true,
      data: {
        checkoutId:  checkout.id,
        checkoutUrl,
        metodo:      "WEB",
        status:      checkout.status,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar pagamento";
    console.error("[SumUp criar]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
