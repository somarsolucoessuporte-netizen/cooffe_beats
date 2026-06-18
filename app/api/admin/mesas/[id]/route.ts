import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { erro, empresaId } = await getAdminSession(["ADMIN"]);
  if (erro) return erro;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const mesa = await prisma.mesa.findFirst({ where: { id, empresaId } });
  if (!mesa) return erroResposta("Mesa não encontrada", 404);

  const atualizada = await prisma.mesa.update({
    where: { id },
    data: {
      nome:          body.nome          ?? undefined,
      ativo:         body.ativo         ?? undefined,
      modoPagamento: body.modoPagamento ?? undefined,
    },
  });

  return resposta(atualizada);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { erro, empresaId } = await getAdminSession(["ADMIN"]);
  if (erro) return erro;

  const { id } = await params;

  const mesa = await prisma.mesa.findFirst({ where: { id, empresaId } });
  if (!mesa) return erroResposta("Mesa não encontrada", 404);

  await prisma.mesa.delete({ where: { id } });
  return resposta({ deleted: true });
}
