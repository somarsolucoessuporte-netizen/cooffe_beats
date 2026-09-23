import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Marca gravada em Caixa.operadorNome quando a abertura vem do totem —
// o painel usa isso para exibir "aberto pelo totem"
const OPERADOR_TOTEM = "Totem";

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
    // Totem sem sessão NextAuth: vincula ao primeiro ADMIN ativo da empresa
    // (ou ao primeiro usuário cadastrado, como fallback) e marca a origem
    empresaId = typeof body.empresaId === "string" ? body.empresaId : undefined;
    if (!empresaId) return erroResposta("Não autenticado", 401);

    const responsavel =
      (await prisma.usuario.findFirst({
        where:   { empresaId, perfil: "ADMIN", ativo: true },
        orderBy: { criadoEm: "asc" },
        select:  { id: true },
      })) ??
      (await prisma.usuario.findFirst({
        where:   { empresaId },
        orderBy: { criadoEm: "asc" },
        select:  { id: true },
      }));

    usuarioId    = responsavel?.id ?? null;
    operadorNome = OPERADOR_TOTEM;
  }

  const caixaAberto = await prisma.caixa.findFirst({
    where: { empresaId, status: "ABERTO" },
  });
  if (caixaAberto) return erroResposta("Já existe um caixa aberto", 409);

  const valorAbertura = Number(body.valorAbertura ?? 0);
  if (!Number.isFinite(valorAbertura) || valorAbertura < 0) {
    return erroResposta("Valor de abertura inválido");
  }

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

  return resposta({ ...caixa, caixaId: caixa.id }, 201);
}
