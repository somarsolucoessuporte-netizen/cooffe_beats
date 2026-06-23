import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWebSession } from "@/lib/web-auth";
import { resposta, erroResposta } from "@/lib/api-response";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

// GET — lista agendamentos futuros do cliente logado
export async function GET() {
  const { user, cliente } = await getWebSession();
  if (!user || !cliente) return erroResposta("Não autenticado", 401);

  const whatsapp = cliente.whatsapp?.replace(/\D/g, "") ?? "";

  // Busca por telefone/whatsapp do cliente
  const agendamentos = await prisma.agendamento.findMany({
    where: {
      empresaId: EMPRESA_ID,
      telefone:  whatsapp,
      data:      { gte: new Date() },
      status:    { not: "CANCELADO" },
    },
    orderBy: { data: "asc" },
    include: { mesa: { select: { numero: true, nome: true } } },
  });

  return resposta(agendamentos);
}

const AgendamentoSchema = z.object({
  data:       z.string().min(1),
  duracao:    z.number().int().positive().optional().default(60),
  pessoas:    z.number().int().min(1).max(20).default(1),
  mesaId:     z.string().optional(),
  observacao: z.string().optional(),
});

// POST — cria agendamento para o cliente logado
export async function POST(req: NextRequest) {
  const { user, cliente } = await getWebSession();
  if (!user || !cliente) return erroResposta("Não autenticado", 401);

  const body  = await req.json();
  const valid = AgendamentoSchema.safeParse(body);
  if (!valid.success) return erroResposta(valid.error.message);

  const { data, duracao, pessoas, mesaId, observacao } = valid.data;

  const dataAgendada = new Date(data);
  if (dataAgendada < new Date()) {
    return erroResposta("A data do agendamento deve ser no futuro");
  }

  const agendamento = await prisma.agendamento.create({
    data: {
      empresaId:   EMPRESA_ID,
      nomeCliente: cliente.nome,
      telefone:    (cliente.whatsapp ?? "").replace(/\D/g, ""),
      data:        dataAgendada,
      duracao,
      pessoas,
      mesaId:      mesaId     ?? null,
      observacao:  observacao ?? null,
      status:      "PENDENTE",
    },
    include: { mesa: { select: { numero: true, nome: true } } },
  });

  return resposta(agendamento, 201);
}
