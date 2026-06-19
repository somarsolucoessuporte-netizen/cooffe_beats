import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";

const Schema = z.object({
  empresaId:   z.string(),
  nomeCliente: z.string().min(2),
  telefone:    z.string().min(10),
  data:        z.string(), // ISO datetime
  duracao:     z.number().int().default(60),
  pessoas:     z.number().int().min(1).default(1),
  mesaId:      z.string().optional(),
  observacao:  z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const v    = Schema.safeParse(body);
    if (!v.success) return erroResposta(v.error.message);

    const agendamento = await prisma.agendamento.create({
      data: {
        empresaId:   v.data.empresaId,
        nomeCliente: v.data.nomeCliente,
        telefone:    v.data.telefone.replace(/\D/g, ""),
        data:        new Date(v.data.data),
        duracao:     v.data.duracao,
        pessoas:     v.data.pessoas,
        mesaId:      v.data.mesaId ?? null,
        observacao:  v.data.observacao ?? null,
        status:      "PENDENTE",
      },
      include: { mesa: { select: { numero: true, nome: true } } },
    });

    return resposta(agendamento, 201);
  } catch {
    return erroResposta("Erro ao criar agendamento", 500);
  }
}
