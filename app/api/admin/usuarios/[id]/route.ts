import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { getAdminSession } from "@/lib/admin-auth";

const UsuarioUpdateSchema = z.object({
  nome: z.string().min(1).optional(),
  email: z.string().email().optional(),
  senha: z.string().min(6).optional(),
  perfil: z.enum(["ADMIN", "GERENTE", "BARISTA", "ATENDENTE"]).optional(),
  ativo: z.boolean().optional(),
});

const CAMPOS_PUBLICOS = {
  id: true,
  nome: true,
  email: true,
  perfil: true,
  ativo: true,
  criadoEm: true,
} as const;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { erro, empresaId } = await getAdminSession(["ADMIN"]);
  if (erro) return erro;

  try {
    const body = await req.json();
    const validacao = UsuarioUpdateSchema.safeParse(body);
    if (!validacao.success) return erroResposta(validacao.error.message);

    const data: Record<string, unknown> = { ...validacao.data };
    if (data.senha) {
      data.senha = await bcrypt.hash(data.senha as string, 12);
    } else {
      delete data.senha;
    }

    const result = await prisma.usuario.updateMany({
      where: { id, empresaId: empresaId! },
      data,
    });
    if (result.count === 0) return erroResposta("Usuário não encontrado", 404);

    const atualizado = await prisma.usuario.findUnique({
      where: { id },
      select: CAMPOS_PUBLICOS,
    });
    return resposta(atualizado);
  } catch {
    return erroResposta("Erro ao atualizar usuário", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { erro, empresaId } = await getAdminSession(["ADMIN"]);
  if (erro) return erro;

  try {
    const result = await prisma.usuario.updateMany({
      where: { id, empresaId: empresaId! },
      data: { ativo: false },
    });
    if (result.count === 0) return erroResposta("Usuário não encontrado", 404);
    return resposta({ deleted: true });
  } catch {
    return erroResposta("Erro ao desativar usuário", 500);
  }
}
