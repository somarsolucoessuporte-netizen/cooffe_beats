import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { getAdminSession } from "@/lib/admin-auth";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://coffeebeats.somar.ia.br";
const CONVITE_VALIDADE_DIAS = 7;

// POST — regenera o token de convite (ex: link expirado ou funcionário perdeu o link)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { erro, empresaId } = await getAdminSession(["ADMIN"]);
  if (erro) return erro;

  const usuario = await prisma.usuario.findFirst({
    where: { id, empresaId: empresaId! },
  });
  if (!usuario) return erroResposta("Usuário não encontrado", 404);

  const conviteToken = randomBytes(16).toString("hex");
  const conviteExpira = new Date(Date.now() + CONVITE_VALIDADE_DIAS * 24 * 60 * 60 * 1000);

  await prisma.usuario.update({
    where: { id },
    data: { conviteToken, conviteExpira },
  });

  return resposta({ conviteUrl: `${BASE_URL}/convite/${conviteToken}` });
}
