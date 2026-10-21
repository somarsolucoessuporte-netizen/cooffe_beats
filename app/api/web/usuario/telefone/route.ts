import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getWebSession } from "@/lib/web-auth";
import { resposta, erroResposta } from "@/lib/api-response";

// Salva o WhatsApp do cliente logado (contas Google chegam sem telefone).
// Formato igual ao do cadastro por email: "55" + DDD + número.
export async function PATCH(req: NextRequest) {
  try {
    const { user, cliente } = await getWebSession();
    if (!user || !cliente) return erroResposta("Não autenticado", 401);

    const body = await req.json() as { telefone?: string };
    var nums = (body.telefone ?? "").replace(/\D/g, "");
    if (nums.length >= 12 && nums.startsWith("55")) nums = nums.slice(2);
    if (nums.length < 10 || nums.length > 11) return erroResposta("WhatsApp inválido.");

    const whatsapp = "55" + nums;

    await prisma.cliente.update({
      where: { id: cliente.id },
      data:  { whatsapp },
    });

    return resposta({ whatsapp });
  } catch (err) {
    // @@unique([empresaId, whatsapp]): número já vinculado a outro cadastro
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return erroResposta("Este WhatsApp já está cadastrado em outra conta.", 409);
    }
    return erroResposta(err instanceof Error ? err.message : "Erro ao salvar WhatsApp", 500);
  }
}
