import { NextRequest, NextResponse } from "next/server";
import { criarCheckout } from "@/lib/sumup";

export async function POST(req: NextRequest) {
  try {
    const { valor, descricao, referencia } = await req.json();

    if (!valor || !referencia) {
      return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
    }

    const checkout = await criarCheckout({ valor, descricao: descricao ?? "", referencia });

    // URL de pagamento: usa checkout_url da API ou monta manualmente
    const checkoutUrl =
      checkout.checkout_url ??
      `https://pay.sumup.com/b2c/${process.env.SUMUP_MERCHANT_CODE}?checkout_id=${checkout.id}`;

    return NextResponse.json({
      ok: true,
      data: {
        checkoutId:  checkout.id,
        checkoutUrl,
        status:      checkout.status,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar pagamento";
    console.error("[SumUp criar]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
