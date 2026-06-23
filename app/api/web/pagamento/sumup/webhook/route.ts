import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { validarAssinaturaWebhook } from "@/lib/sumup-web";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Valida assinatura HMAC-SHA256 (se affiliateKey configurada)
    const signature = req.headers.get("x-payload-signature-sha256") ??
                      req.headers.get("x-webhook-signature") ?? "";

    const configSumup = await prisma.configuracao.findUnique({
      where:  { empresaId: EMPRESA_ID },
      select: { sumupAffiliateKey: true },
    });

    if (configSumup?.sumupAffiliateKey && signature) {
      if (!validarAssinaturaWebhook(rawBody, signature, configSumup.sumupAffiliateKey)) {
        console.error("[Webhook SumUp Web] Assinatura inválida");
        return Response.json({ ok: false }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody) as Record<string, unknown>;

    // SumUp pode enviar o payload direto ou dentro de body.payload
    const payload   = (body.payload ?? body) as Record<string, unknown>;
    const status    = (payload.status ?? body.status) as string | undefined;
    const checkoutRef = (payload.checkout_reference ?? body.checkout_reference) as string | undefined;

    // Responde 200 mesmo se não for PAID (para SumUp não retentar)
    if (status !== "PAID" && status !== "SUCCESSFUL") {
      return Response.json({ ok: true });
    }
    if (!checkoutRef) {
      console.error("[Webhook SumUp Web] checkout_reference ausente");
      return Response.json({ ok: true });
    }

    // Busca sessão de checkout
    const sessao = await prisma.checkoutSessao.findUnique({ where: { id: checkoutRef } });
    if (!sessao || sessao.status === "PAGO") {
      return Response.json({ ok: true }); // idempotência
    }

    // Cria pedido em transação
    const pedido = await prisma.$transaction(async function (tx) {
      const config = await tx.configuracao.findUnique({ where: { empresaId: EMPRESA_ID } });
      if (!config) throw new Error("Configuração não encontrada");

      const novaSenha = config.senhaAtual + 1;
      await tx.configuracao.update({ where: { empresaId: EMPRESA_ID }, data: { senhaAtual: novaSenha } });
      const senha = `${config.prefixoSenha}-${novaSenha}`;

      const caixaAberto = await tx.caixa.findFirst({
        where:  { empresaId: EMPRESA_ID, status: "ABERTO" },
        select: { id: true },
      });

      type ItemSessao = { produtoId: string; nome: string; preco: number; quantidade: number };
      const itens = sessao.itensJson as ItemSessao[];
      const subtotal = Number(sessao.total);

      const novoPedido = await tx.pedido.create({
        data: {
          empresaId:           EMPRESA_ID,
          senha,
          status:              "RECEBIDO",
          origem:              "APP",
          subtotal,
          total:               subtotal,
          clienteId:           sessao.clienteId,
          caixaId:             caixaAberto?.id ?? null,
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
              };
            }),
          },
        },
        include: { itens: { include: { produto: true } } },
      });

      // Registra pagamento
      await tx.pagamento.create({
        data: {
          pedidoId:  novoPedido.id,
          metodo:    "PIX",
          status:    "APROVADO",
          valor:     subtotal,
          referencia: sessao.id,
          payload:   body as object,
          paidAt:    new Date(),
        },
      });

      // Marca sessão como PAGO
      await tx.checkoutSessao.update({
        where: { id: sessao.id },
        data:  { status: "PAGO", pedidoId: novoPedido.id },
      });

      // Atualiza estatísticas do cliente
      await tx.cliente.update({
        where: { id: sessao.clienteId },
        data:  { totalGasto: { increment: subtotal } },
      }).catch(function () {});

      return novoPedido;
    });

    // Broadcast para o KDS em tempo real
    await supabaseAdmin.channel(`empresa-${EMPRESA_ID}`).send({
      type:    "broadcast",
      event:   "pedido:novo",
      payload: { ...pedido, pagamentoAntecipado: true },
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[Webhook SumUp Web]", err);
    return Response.json({ ok: false }); // não retornar 5xx para SumUp não retentar
  }
}
