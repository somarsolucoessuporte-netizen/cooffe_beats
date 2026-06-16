import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { supabaseAdmin } from "@/lib/supabase";
import { notificarWhatsApp } from "@/lib/notificar-whatsapp";

const AtualizarStatusSchema = z.object({
  status: z.enum(["RECEBIDO", "EM_PREPARO", "PRONTO", "ENTREGUE", "CANCELADO"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const validacao = AtualizarStatusSchema.safeParse(body);

    if (!validacao.success) {
      return erroResposta(validacao.error.message);
    }

    const { status } = validacao.data;

    // Campos de timestamp conforme transição de status
    const timestamps: Record<string, Date | null> = {};
    if (status === "EM_PREPARO") timestamps.iniciadoEm = new Date();
    if (status === "PRONTO") timestamps.prontoEm = new Date();
    if (status === "ENTREGUE") timestamps.entregueEm = new Date();

    const pedido = await prisma.pedido.update({
      where: { id },
      data: { status, ...timestamps },
      include: {
        itens: {
          include: {
            produto: true,
            adicionais: { include: { adicional: true } },
          },
        },
        cliente: { select: { nome: true, whatsapp: true } },
      },
    });

    // Notificação WhatsApp (fire-and-forget)
    if (pedido.cliente?.whatsapp && (status === "PRONTO" || status === "ENTREGUE")) {
      notificarWhatsApp({
        whatsapp: pedido.cliente.whatsapp,
        tipo: status === "PRONTO" ? "PEDIDO_PRONTO" : "PEDIDO_ENTREGUE",
        cliente: { nome: pedido.cliente.nome },
        pedido: {
          senha: pedido.senha,
          itens: pedido.itens.map(i => ({ nome: i.produto.nome, quantidade: i.quantidade })),
          total: Number(pedido.total),
        },
      });
    }

    await supabaseAdmin.channel(`empresa-${pedido.empresaId}`).send({
      type: "broadcast",
      event: "pedido:atualizado",
      payload: { id: pedido.id, status: pedido.status, senha: pedido.senha },
    });

    return resposta(pedido);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar status";
    return erroResposta(msg, 500);
  }
}
