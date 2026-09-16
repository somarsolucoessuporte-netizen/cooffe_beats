import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";

const MENSAGEM_INVALIDO = "Link inválido ou expirado. Solicite um novo ao administrador.";

// GET — valida o token de convite (rota pública, sem login)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const usuario = await prisma.usuario.findUnique({
    where: { conviteToken: token },
    select: { nome: true, email: true, conviteExpira: true },
  });

  if (!usuario || !usuario.conviteExpira || usuario.conviteExpira < new Date()) {
    return erroResposta(MENSAGEM_INVALIDO, 404);
  }

  return resposta({ nome: usuario.nome, email: usuario.email });
}

// POST — funcionário cria a própria senha (rota pública, sem login)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));

  const { senha, confirmacao } = body as { senha?: string; confirmacao?: string };
  if (!senha || senha.length < 6) return erroResposta("Senha deve ter pelo menos 6 caracteres");
  if (senha !== confirmacao) return erroResposta("As senhas não conferem");

  const usuario = await prisma.usuario.findUnique({
    where: { conviteToken: token },
    select: { id: true, conviteExpira: true },
  });

  if (!usuario || !usuario.conviteExpira || usuario.conviteExpira < new Date()) {
    return erroResposta(MENSAGEM_INVALIDO, 404);
  }

  const senhaHash = await bcrypt.hash(senha, 12);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      senha: senhaHash,
      ativo: true,
      conviteToken: null,
      conviteExpira: null,
    },
  });

  return resposta({ ok: true });
}
