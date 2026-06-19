import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const status = req.nextUrl.searchParams.get("status");
  const data   = req.nextUrl.searchParams.get("data");

  try {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (data) {
      const dia   = new Date(data);
      const amanha = new Date(dia);
      amanha.setDate(amanha.getDate() + 1);
      where.data = { gte: dia, lt: amanha };
    }

    const agendamentos = await prisma.agendamento.findMany({
      where,
      include: { mesa: { select: { numero: true, nome: true } } },
      orderBy: { data: "asc" },
      take: 200,
    });

    return resposta(agendamentos);
  } catch {
    return erroResposta("Erro ao buscar agendamentos", 500);
  }
}

export async function PATCH(req: NextRequest) {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  try {
    const { id, status } = await req.json();
    if (!id || !status) return erroResposta("id e status obrigatórios");

    const ag = await prisma.agendamento.update({ where: { id }, data: { status } });
    return resposta(ag);
  } catch {
    return erroResposta("Erro ao atualizar agendamento", 500);
  }
}
