import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { liberarPedidoPago } from "@/lib/liberar-pedido";
import { protegerPedido } from "@/lib/dividir-conta/guards";
import { cancelarPagamentoPoint, cancelarOrderMp } from "@/lib/mercadopago";
import { PIX_CHAVE_CNPJ, PIX_COMPROVANTE } from "@/lib/pix-estatico";
import { procurarPagamentoRecente, type CandidatoMp } from "@/lib/conciliacao-manual";
import { SEM_CONCILIACAO } from "@/lib/metodos-pagamento";
import type { MetodoPagamento, Prisma } from "@prisma/client";

export const maxDuration = 30;

const AVISO_NAO_ENCONTRADO = "Nenhum pagamento encontrado no Mercado Pago. Confirme só se viu 'Aprovado' na maquininha.";

/** Grava o pagamento encontrado no pedido. false = outro pedido usou o mesmo pagamento nesse meio tempo. */
async function vincular(pedidoId: string, valor: Prisma.Decimal, botao: MetodoPagamento, achado: CandidatoMp) {
  return prisma.$transaction(async (tx) => {
    // Um pagamento do Mercado Pago só pode fechar um pedido
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"mp:" + achado.paymentId}))`;
    const usado = await tx.pagamento.findFirst({
      where:  { pedidoId: { not: pedidoId }, payload: { path: ["paymentId"], equals: achado.paymentId } },
      select: { id: true },
    });
    if (usado) return false;

    const atual = await tx.pagamento.findUnique({ where: { pedidoId }, select: { payload: true } });
    const dados = {
      status: "APROVADO" as const,
      paidAt: new Date(),
      confirmadoManualmente: true,
      metodo: achado.metodo ?? botao,
      payload: {
        ...(atual?.payload as Prisma.InputJsonObject | null),
        paymentId: achado.paymentId, tipo: achado.tipo, conciliacao: "vinculado_mp",
        mpReferencia: achado.referencia, mpAprovadoEm: achado.aprovadoEm,
      },
    };
    if (atual) await tx.pagamento.updateMany({ where: { pedidoId, status: "PENDENTE" }, data: dados });
    else await tx.pagamento.create({ data: { pedidoId, valor, referencia: `MAN-${Date.now()}`, ...dados } });
    return true;
  });
}

const Schema = z.object({
  metodo: z.enum(["PIX", "CARTAO"]),
  // Pix estático pela chave CNPJ exibido na tela: o atendente confirma que o dinheiro caiu
  origem: z.literal("PIX_CNPJ").optional(),
  // false: 1ª confirmação (se o MP não tiver o pagamento, pede a 2ª); true: atendente insistiu.
  // Ausente = tela antiga ainda aberta no totem: confirma e marca como sem conciliação.
  semConciliacao: z.boolean().optional(),
});

/**
 * POST /api/pagamentos/confirmar-manual/[pedidoId]
 * Fallback manual enquanto a maquininha SumUp não recebe a cobrança pela API:
 * o cliente paga direto na maquininha e o atendente confirma no totem (confirmação dupla).
 * O pedido sai de AGUARDANDO_PAGAMENTO para RECEBIDO (entra no KDS) e o pagamento
 * fica APROVADO com `confirmadoManualmente`. Se o webhook já aprovou, não altera nada.
 *
 * Maquininha: antes procura no Mercado Pago um pagamento aprovado do mesmo valor nos últimos
 * 15 min. Achou: vincula e grava o método real. Não achou: exige a 2ª confirmação e marca
 * "manual sem conciliação", que aparece no fechamento do caixa.
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
    const { metodo, origem, semConciliacao } = validacao.data;
    const pixCnpj = origem === "PIX_CNPJ";

    const pedido = await prisma.pedido.findUnique({
      where:  { id: pedidoId },
      select: { status: true, total: true, pagamento: { select: { status: true, payload: true, pixOrderId: true, referencia: true } } },
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

    if (!pixCnpj) {
      let candidatos: CandidatoMp[] = [];
      let consultou = true;
      try {
        candidatos = await procurarPagamentoRecente(pedidoId, Number(pedido.total), pedido.pagamento?.referencia ?? null);
      } catch (e) {
        consultou = false;
        console.warn("[Confirmar manual] consulta ao MP falhou:", e instanceof Error ? e.message : e);
      }
      for (const achado of candidatos) {
        if (!await vincular(pedidoId, pedido.total, metodo === "PIX" ? "PIX" : "CARTAO_CREDITO", achado)) continue;
        await liberarPedidoPago(pedidoId);
        return NextResponse.json({ ok: true, jaAprovado: false, vinculado: true });
      }
      if (semConciliacao === false) {
        return NextResponse.json({
          ok: false,
          precisaConfirmar: true,
          error: consultou ? AVISO_NAO_ENCONTRADO : "Não foi possível consultar o Mercado Pago. Confirme só se viu 'Aprovado' na maquininha.",
        });
      }
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
      ...(pixCnpj
        ? { metodo: "PIX" as const, payload: registroPix }
        : { payload: { ...(payloadAnterior as Prisma.InputJsonObject | null), conciliacao: SEM_CONCILIACAO } }),
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

    // Pix recebido pela chave CNPJ: a order do QR dinâmico não pode mais ser paga (segundo plano)
    if (pixCnpj && pedido.pagamento?.pixOrderId) void cancelarOrderMp(pedido.pagamento.pixOrderId);

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
