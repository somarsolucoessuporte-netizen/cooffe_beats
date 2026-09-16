import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";

// GET — busca cliente por whatsapp (chamado pelo totem, sem auth, pra reconhecimento automático)
export async function GET(req: NextRequest) {
  const empresaId = req.nextUrl.searchParams.get("empresaId");
  const whatsapp = req.nextUrl.searchParams.get("whatsapp");

  if (!empresaId || !whatsapp) {
    return erroResposta("empresaId e whatsapp são obrigatórios");
  }

  const wppLimpo = whatsapp.replace(/\D/g, "");
  if (wppLimpo.length < 10) return erroResposta("WhatsApp inválido");

  const cliente = await prisma.cliente.findUnique({
    where: { empresaId_whatsapp: { empresaId, whatsapp: wppLimpo } },
    select: { id: true, nome: true, whatsapp: true },
  });

  if (!cliente) return erroResposta("Cliente não encontrado", 404);
  return resposta(cliente);
}
