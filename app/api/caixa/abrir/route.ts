import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return erroResposta("Não autenticado", 401);

  const user = session.user as { empresaId?: string; usuarioId?: string };
  const empresaId = user.empresaId;
  const usuarioId = user.usuarioId;

  if (!empresaId || !usuarioId) return erroResposta("Sessão inválida", 401);

  const caixaAberto = await prisma.caixa.findFirst({
    where: { empresaId, status: "ABERTO" },
  });
  if (caixaAberto) return erroResposta("Já existe um caixa aberto", 409);

  const body = await req.json().catch(() => ({}));
  const valorAbertura = Number(body.valorAbertura ?? 0);

  const caixa = await prisma.caixa.create({
    data: {
      empresaId,
      usuarioId,
      valorAbertura,
      observacao: body.observacao ?? null,
    },
    include: { usuario: { select: { nome: true } } },
  });

  return resposta(caixa, 201);
}
