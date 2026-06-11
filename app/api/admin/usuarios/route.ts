import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { getAdminSession } from "@/lib/admin-auth";

const UsuarioSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  senha: z.string().min(6),
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
} as const;

export async function GET() {
  const { erro, empresaId } = await getAdminSession(["ADMIN"]);
  if (erro) return erro;

  try {
    const usuarios = await prisma.usuario.findMany({
      where: { empresaId: empresaId! },
      select: CAMPOS_PUBLICOS,
      orderBy: { nome: "asc" },
    });
    return resposta(usuarios);
  } catch {
    return erroResposta("Erro ao buscar usuários", 500);
  }
}

export async function POST(req: NextRequest) {
  const { erro, empresaId } = await getAdminSession(["ADMIN"]);
  if (erro) return erro;

  try {
    const body = await req.json();
    const validacao = UsuarioSchema.safeParse(body);
    if (!validacao.success) return erroResposta(validacao.error.message);

    const senhaHash = await bcrypt.hash(validacao.data.senha, 12);

    const usuario = await prisma.usuario.create({
      data: { ...validacao.data, senha: senhaHash, empresaId: empresaId! },
      select: CAMPOS_PUBLICOS,
    });
    return resposta(usuario, 201);
  } catch (err) {
    const isDuplicate =
      err instanceof Error && err.message.toLowerCase().includes("unique");
    return erroResposta(isDuplicate ? "Email já cadastrado" : "Erro ao criar usuário", 500);
  }
}
