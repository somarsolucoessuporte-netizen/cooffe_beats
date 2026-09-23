import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

// POST — zera o contador de senhas (próximo pedido sai como <prefixo>-1)
export async function POST() {
  const { erro, empresaId } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const config = await prisma.configuracao
    .update({
      where:  { empresaId },
      data:   { senhaAtual: 0 },
      select: { senhaAtual: true, prefixoSenha: true },
    })
    .catch(() => null);

  if (!config) return erroResposta("Configuração não encontrada", 404);

  return resposta(config);
}
