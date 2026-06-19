import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const { id } = await params;
  try {
    const body  = await req.json();
    const cupom = await prisma.cupom.update({ where: { id }, data: body });
    return resposta(cupom);
  } catch {
    return erroResposta("Erro ao atualizar cupom", 500);
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { erro } = await getAdminSession(["ADMIN"]);
  if (erro) return erro;

  const { id } = await params;
  try {
    await prisma.cupom.delete({ where: { id } });
    return resposta({ id });
  } catch {
    return erroResposta("Erro ao excluir cupom", 500);
  }
}
