import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const body = await req.json().catch(() => ({}));

  let empresaId: string | undefined;
  let usuarioId: string | null = null;
  let operadorNome: string | null = null;

  if (session?.user) {
    // Admin/staff logado — operador é o usuário da sessão
    const user = session.user as { empresaId?: string; usuarioId?: string };
    empresaId = user.empresaId;
    usuarioId = user.usuarioId ?? null;
    if (!empresaId || !usuarioId) return erroResposta("Sessão inválida", 401);
  } else {
    // Totem anônimo — sem sessão NextAuth, exige nome do operador digitado na tela
    empresaId = typeof body.empresaId === "string" ? body.empresaId : undefined;
    operadorNome = typeof body.operadorNome === "string" ? body.operadorNome.trim() : "";
    if (!empresaId || !operadorNome) return erroResposta("Não autenticado", 401);
  }

  const caixaAberto = await prisma.caixa.findFirst({
    where: { empresaId, status: "ABERTO" },
  });
  if (caixaAberto) return erroResposta("Já existe um caixa aberto", 409);

  const valorAbertura = Number(body.valorAbertura ?? 0);

  const caixa = await prisma.caixa.create({
    data: {
      empresaId,
      usuarioId,
      operadorNome,
      valorAbertura,
      observacao: body.observacao ?? null,
    },
    include: { usuario: { select: { nome: true } } },
  });

  return resposta(caixa, 201);
}
