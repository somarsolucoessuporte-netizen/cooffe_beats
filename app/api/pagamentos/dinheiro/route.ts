import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { supabaseAdmin } from "@/lib/supabase";

const Schema = z.object({
  pedidoId: z.string(),
  valor:    z.number().positive(),
});

/**
 * POST /api/pagamentos/dinheiro
 * Registra pagamento em dinheiro para pedido do totem.
 * O cliente paga presencialmente no balcão — o pedido entra
 * direto em RECEBIDO sem aguardar confirmação externa.
 */
export async function POST(req: NextRequest) {
  try {
    const body     = await req.json();
    const validacao = Schema.safeParse(body);
    if (!validacao.success) return erroResposta(validacao.error.message);

    const { pedidoId, valor } = validacao.data;

    const pagamento = await prisma.$transaction(async function (tx) {
      // Cria registro de pagamento: DINHEIRO + APROVADO
      // (aprovado pois o staff confirma presencialmente no balcão)
      const pag = await tx.pagamento.create({
        data: {
          pedidoId,
          metodo:    "DINHEIRO",
          status:    "APROVADO",
          valor,
          referencia: `DIN-${Date.now()}`,
          paidAt:    new Date(),
        },
      });

      // Pedido já entra como RECEBIDO — fluxo normal de preparo
      await tx.pedido.update({
        where: { id: pedidoId },
        data:  { status: "RECEBIDO" },
      });

      return pag;
    });

    // Busca o pedido para broadcast (inclui empresa para o canal)
    const pedido = await prisma.pedido.findUnique({
      where:   { id: pedidoId },
      select:  { empresaId: true, senha: true, status: true },
    });

    if (pedido) {
      await supabaseAdmin.channel(`empresa-${pedido.empresaId}`).send({
        type:    "broadcast",
        event:   "pedido:atualizado",
        payload: {
          id:       pedidoId,
          status:   "RECEBIDO",
          senha:    pedido.senha,
          pagamento: { metodo: "DINHEIRO", status: "APROVADO" },
        },
      });
    }

    return resposta(pagamento, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao registrar pagamento em dinheiro";
    return erroResposta(msg, 500);
  }
}
