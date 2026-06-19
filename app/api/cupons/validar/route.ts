import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";

const Schema = z.object({
  codigo:      z.string().min(1),
  valorPedido: z.number().positive(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const v    = Schema.safeParse(body);
    if (!v.success) return erroResposta("Dados inválidos");

    const { codigo, valorPedido } = v.data;

    const cupom = await prisma.cupom.findUnique({ where: { codigo: codigo.toUpperCase() } });

    if (!cupom)       return erroResposta("Cupom não encontrado", 404);
    if (!cupom.ativo) return erroResposta("Cupom inativo", 400);

    if (cupom.validoAte && new Date() > cupom.validoAte) {
      return erroResposta("Cupom expirado", 400);
    }

    if (cupom.usoMaximo !== null && cupom.usoAtual >= cupom.usoMaximo) {
      return erroResposta("Cupom esgotado", 400);
    }

    if (cupom.pedidoMinimo !== null && valorPedido < cupom.pedidoMinimo) {
      return erroResposta(
        `Pedido mínimo de R$${cupom.pedidoMinimo.toFixed(2).replace(".", ",")} para este cupom`,
        400
      );
    }

    const desconto =
      cupom.tipo === "percentual"
        ? (valorPedido * cupom.valor) / 100
        : Math.min(cupom.valor, valorPedido);

    return resposta({ cupom, desconto: Math.round(desconto * 100) / 100 });
  } catch {
    return erroResposta("Erro ao validar cupom", 500);
  }
}
