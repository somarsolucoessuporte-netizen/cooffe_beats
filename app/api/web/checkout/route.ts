import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWebSession } from "@/lib/web-auth";
import { resposta, erroResposta } from "@/lib/api-response";
import { supabaseAdmin } from "@/lib/supabase";
import { calcularCarrinhoWeb } from "@/lib/carrinho-web";

// Preços e desconto vindos do navegador são ignorados — tudo é recalculado no servidor
const ItemSchema = z.object({
  produtoId:  z.string(),
  quantidade: z.number().int().positive(),
  observacao: z.string().optional(),
  adicionais: z.array(z.object({ adicionalId: z.string() })).optional(),
});

const CheckoutSchema = z.object({
  itens:      z.array(ItemSchema).min(1),
  cupomId:    z.string().optional(),
  observacao: z.string().optional(),
});

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

export async function POST(req: NextRequest) {
  try {
    const { user, cliente } = await getWebSession();
    if (!user || !cliente) return erroResposta("Não autenticado", 401);
    // Contas Google chegam sem telefone: o carrinho abre o modal de WhatsApp ao receber 422
    if (!cliente.whatsapp) return erroResposta("Informe seu WhatsApp para continuar.", 422);

    const body  = await req.json();
    const valid = CheckoutSchema.safeParse(body);
    if (!valid.success) return erroResposta(valid.error.message);

    const { itens, cupomId, observacao } = valid.data;

    const carrinho = await calcularCarrinhoWeb(EMPRESA_ID, itens, cupomId);
    if ("erro" in carrinho) return erroResposta(carrinho.erro);

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

      if (carrinho.cupomId) {
        await tx.cupom.updateMany({ where: { id: carrinho.cupomId }, data: { usoAtual: { increment: 1 } } });
      }

      return tx.pedido.create({
        data: {
          empresaId:     EMPRESA_ID,
          senha,
          status:        "RECEBIDO",
          origem:        "APP",
          subtotal:      carrinho.subtotal,
          total:         carrinho.total,
          observacao:    observacao ?? null,
          caixaId:       caixaAberto?.id ?? null,
          clienteId:     cliente.id,
          cupomId:       carrinho.cupomId,
          valorDesconto: carrinho.desconto > 0 ? carrinho.desconto : null,
          itens: {
            create: carrinho.itens.map(function (item) {
              return {
                produtoId:  item.produtoId,
                quantidade: item.quantidade,
                precoUnit:  item.preco,
                precoTotal: item.preco * item.quantidade,
                observacao: item.observacao ?? null,
                adicionais: {
                  create: (item.adicionais ?? []).map(function (a) {
                    return { adicionalId: a.adicionalId, preco: a.preco };
                  }),
                },
              };
            }),
          },
        },
        include: {
          itens: { include: { produto: true, adicionais: { include: { adicional: true } } } },
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
