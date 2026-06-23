import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWebSession } from "@/lib/web-auth";
import { resposta, erroResposta } from "@/lib/api-response";
import { supabaseAdmin } from "@/lib/supabase";

const ItemSchema = z.object({
  produtoId:  z.string(),
  quantidade: z.number().int().positive(),
  precoUnit:  z.number().positive(),
  observacao: z.string().optional(),
});

const CheckoutSchema = z.object({
  itens:         z.array(ItemSchema).min(1),
  cupomId:       z.string().optional(),
  valorDesconto: z.number().optional(),
  observacao:    z.string().optional(),
});

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

export async function POST(req: NextRequest) {
  try {
    const { user, cliente } = await getWebSession();
    if (!user || !cliente) return erroResposta("Não autenticado", 401);

    const body  = await req.json();
    const valid = CheckoutSchema.safeParse(body);
    if (!valid.success) return erroResposta(valid.error.message);

    const { itens, cupomId, valorDesconto, observacao } = valid.data;

    const pedido = await prisma.$transaction(async function (tx) {
      const config = await tx.configuracao.findUnique({ where: { empresaId: EMPRESA_ID } });
      if (!config) throw new Error("Configuração da empresa não encontrada");

      const novaSenha = config.senhaAtual + 1;
      await tx.configuracao.update({ where: { empresaId: EMPRESA_ID }, data: { senhaAtual: novaSenha } });
      const senha = `${config.prefixoSenha}-${novaSenha}`;

      const caixaAberto = await tx.caixa.findFirst({
        where: { empresaId: EMPRESA_ID, status: "ABERTO" },
        select: { id: true },
      });

      const subtotal = itens.reduce(function (acc, item) {
        return acc + item.precoUnit * item.quantidade;
      }, 0);
      const desconto = valorDesconto ?? 0;
      const total    = Math.max(0, subtotal - desconto);

      if (cupomId) {
        await tx.cupom.update({ where: { id: cupomId }, data: { usoAtual: { increment: 1 } } });
      }

      return tx.pedido.create({
        data: {
          empresaId:     EMPRESA_ID,
          senha,
          status:        "RECEBIDO",
          origem:        "APP",
          subtotal,
          total,
          observacao:    observacao ?? null,
          caixaId:       caixaAberto?.id ?? null,
          clienteId:     cliente.id,
          cupomId:       cupomId      ?? null,
          valorDesconto: desconto > 0 ? desconto : null,
          itens: {
            create: itens.map(function (item) {
              return {
                produtoId:  item.produtoId,
                quantidade: item.quantidade,
                precoUnit:  item.precoUnit,
                precoTotal: item.precoUnit * item.quantidade,
                observacao: item.observacao ?? null,
              };
            }),
          },
        },
        include: {
          itens: { include: { produto: true } },
        },
      });
    });

    // Atualiza estatísticas do cliente (fire-and-forget)
    prisma.cliente.update({
      where: { id: cliente.id },
      data:  { totalGasto: { increment: Number(pedido.total) } },
    }).catch(function () {});

    // Broadcast para o KDS e tela de confirmação
    await supabaseAdmin.channel(`empresa-${EMPRESA_ID}`).send({
      type:    "broadcast",
      event:   "pedido:novo",
      payload: pedido,
    });

    return resposta(pedido, 201);
  } catch (err) {
    return erroResposta(err instanceof Error ? err.message : "Erro no checkout", 500);
  }
}
