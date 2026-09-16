import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { getAdminSession } from "@/lib/admin-auth";

const UsuarioSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  perfil: z.enum(["ADMIN", "GERENTE", "BARISTA", "ATENDENTE"]),
  ativo: z.boolean().default(true),
});

const CAMPOS_PUBLICOS = {
  id: true,
  nome: true,
  email: true,
  perfil: true,
  ativo: true,
  criadoEm: true,
  senha: true,
} as const;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://coffeebeats.somar.ia.br";
const CONVITE_VALIDADE_DIAS = 7;

function paraPublico(u: { senha: string | null } & Record<string, unknown>) {
  const { senha, ...resto } = u;
  return { ...resto, senhaDefinida: !!senha };
}

export async function GET() {
  const { erro, empresaId } = await getAdminSession(["ADMIN"]);
  if (erro) return erro;

  try {
    const usuarios = await prisma.usuario.findMany({
      where: { empresaId: empresaId! },
      select: CAMPOS_PUBLICOS,
      orderBy: { nome: "asc" },
    });
    return resposta(usuarios.map(paraPublico));
  } catch {
    return erroResposta("Erro ao buscar usuários", 500);
  }
}

// POST — cria usuário sem senha e gera um link de convite (funcionário cria a própria senha)
export async function POST(req: NextRequest) {
  const { erro, empresaId } = await getAdminSession(["ADMIN"]);
  if (erro) return erro;

  try {
    const body = await req.json();
    const validacao = UsuarioSchema.safeParse(body);
    if (!validacao.success) return erroResposta(validacao.error.message);

    const conviteToken = randomBytes(16).toString("hex");
    const conviteExpira = new Date(Date.now() + CONVITE_VALIDADE_DIAS * 24 * 60 * 60 * 1000);

    const usuario = await prisma.usuario.create({
      data: { ...validacao.data, empresaId: empresaId!, conviteToken, conviteExpira },
      select: CAMPOS_PUBLICOS,
    });

    return resposta(
      { ...paraPublico(usuario), conviteUrl: `${BASE_URL}/convite/${conviteToken}` },
      201
    );
  } catch (err) {
    const isDuplicate =
      err instanceof Error && err.message.toLowerCase().includes("unique");
    return erroResposta(isDuplicate ? "Email já cadastrado" : "Erro ao criar usuário", 500);
  }
}
