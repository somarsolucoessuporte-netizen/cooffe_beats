import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";

const SimularPagamentoSchema = z.object({
  pedidoId: z.string(),
  valor: z.number().positive(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validacao = SimularPagamentoSchema.safeParse(body);

    if (!validacao.success) {
      return erroResposta(validacao.error.message);
    }

    const { pedidoId, valor } = validacao.data;

    const pagamento = await prisma.$transaction(async (tx) => {
      const pag = await tx.pagamento.create({
        data: {
          pedidoId,
          metodo: "SIMULADO",
          status: "APROVADO",
          valor,
          referencia: `SIM-${Date.now()}`,
          paidAt: new Date(),
        },
      });

      await tx.pedido.update({
        where: { id: pedidoId },
        data: { status: "RECEBIDO" },
      });

      return pag;
    });

    return resposta(pagamento, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao simular pagamento";
    return erroResposta(msg, 500);
  }
}
