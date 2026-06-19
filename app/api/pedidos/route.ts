import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { supabaseAdmin } from "@/lib/supabase";
import { notificarWhatsApp } from "@/lib/notificar-whatsapp";

const ItemSchema = z.object({
  produtoId: z.string(),
  quantidade: z.number().int().positive(),
  precoUnit: z.number().positive(),
  observacao: z.string().optional(),
  adicionais: z
    .array(
      z.object({
        adicionalId: z.string(),
        preco: z.number(),
      })
    )
    .optional(),
});

const CriarPedidoSchema = z.object({
  empresaId:     z.string(),
  itens:         z.array(ItemSchema).min(1),
  observacao:    z.string().optional(),
  clienteId:     z.string().optional(),
  mesaId:        z.string().optional(),
  status:        z.enum(["RECEBIDO", "COMANDA_ABERTA"]).optional(),
  cupomId:       z.string().optional(),
  valorDesconto: z.number().optional(),
  canalVendaId:  z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validacao = CriarPedidoSchema.safeParse(body);

    if (!validacao.success) {
      return erroResposta(validacao.error.message);
    }

    const { empresaId, itens, observacao, clienteId, mesaId, status, cupomId, valorDesconto, canalVendaId } = validacao.data;

    const pedido = await prisma.$transaction(async (tx) => {
      // Gerar senha sequencial
      const config = await tx.configuracao.findUnique({
        where: { empresaId },
      });

      if (!config) {
        throw new Error("Configuração da empresa não encontrada");
      }

      const novaSenha = config.senhaAtual + 1;
      await tx.configuracao.update({
        where: { empresaId },
        data: { senhaAtual: novaSenha },
      });

      const senha = `${config.prefixoSenha}-${novaSenha}`;

      // Vincular ao caixa aberto (se existir)
      const caixaAberto = await tx.caixa.findFirst({
        where: { empresaId, status: "ABERTO" },
        select: { id: true },
      });

      // Calcular totais
      const subtotal = itens.reduce((acc, item) => {
        const totalAdicionais = (item.adicionais ?? []).reduce(
          (s, a) => s + a.preco,
          0
        );
        return acc + (item.precoUnit + totalAdicionais) * item.quantidade;
      }, 0);

      const desconto = valorDesconto ?? 0;
      const total    = Math.max(0, subtotal - desconto);

      // Incrementar uso do cupom dentro da transação
      if (cupomId) {
        await tx.cupom.update({ where: { id: cupomId }, data: { usoAtual: { increment: 1 } } });
      }

      // Criar pedido com itens
      const novoPedido = await tx.pedido.create({
        data: {
          empresaId,
          senha,
          status:        status ?? "RECEBIDO",
          subtotal,
          total,
          observacao,
          caixaId:       caixaAberto?.id ?? null,
          clienteId:     clienteId      ?? null,
          mesaId:        mesaId         ?? null,
          cupomId:       cupomId        ?? null,
          valorDesconto: desconto > 0 ? desconto : null,
          canalVendaId:  canalVendaId   ?? null,
          itens: {
            create: itens.map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade,
              precoUnit: item.precoUnit,
              precoTotal: item.precoUnit * item.quantidade,
              observacao: item.observacao,
              adicionais: {
                create: (item.adicionais ?? []).map((a) => ({
                  adicionalId: a.adicionalId,
                  preco: a.preco,
                })),
              },
            })),
          },
        },
        include: {
          itens: {
            include: {
              produto: true,
              adicionais: { include: { adicional: true } },
            },
          },
        },
      });

      return novoPedido;
    });

    // Atualiza estatísticas do cliente em background (fire-and-forget)
    if (clienteId) {
      prisma.cliente.update({
        where: { id: clienteId },
        data: { totalGasto: { increment: Number(pedido.total) } },
      }).catch(() => {});

      // Notificação WhatsApp de confirmação
      prisma.cliente.findUnique({ where: { id: clienteId }, select: { nome: true, whatsapp: true } })
        .then(function(cliente) {
          if (!cliente?.whatsapp) return;
          notificarWhatsApp({
            whatsapp: cliente.whatsapp,
            tipo: "PEDIDO_CONFIRMADO",
            cliente: { nome: cliente.nome },
            pedido: {
              senha: pedido.senha,
              itens: pedido.itens.map(function(i) { return { nome: i.produto.nome, quantidade: i.quantidade }; }),
              total: Number(pedido.total),
            },
          });
        })
        .catch(function() {});
    }

    await supabaseAdmin.channel(`empresa-${empresaId}`).send({
      type: "broadcast",
      event: "pedido:novo",
      payload: pedido,
    });

    return resposta(pedido, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao criar pedido";
    return erroResposta(msg, 500);
  }
}

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const empresaId = req.nextUrl.searchParams.get("empresaId");

  if (!empresaId) {
    return erroResposta("empresaId é obrigatório");
  }

  try {
    const pedidos = await prisma.pedido.findMany({
      where: {
        empresaId,
        ...(status ? { status: status as never } : {}),
      },
      include: {
        itens: {
          include: {
            produto: true,
            adicionais: { include: { adicional: true } },
          },
        },
        pagamento: true,
      },
      orderBy: { criadoEm: "desc" },
    });

    return resposta(pedidos);
  } catch {
    return erroResposta("Erro ao buscar pedidos", 500);
  }
}
