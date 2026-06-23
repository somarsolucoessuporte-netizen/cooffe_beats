import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWebSession } from "@/lib/web-auth";
import { resposta, erroResposta } from "@/lib/api-response";
import { supabaseAdmin } from "@/lib/supabase";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

// GET — retorna comanda aberta do cliente logado
export async function GET() {
  const { user, cliente } = await getWebSession();
  if (!user || !cliente) return erroResposta("Não autenticado", 401);

  const comanda = await prisma.pedido.findFirst({
    where:   { clienteId: cliente.id, status: "COMANDA_ABERTA" },
    orderBy: { criadoEm: "desc" },
    include: {
      itens: {
        include: {
          produto:    true,
          adicionais: { include: { adicional: true } },
        },
      },
      mesa:      { select: { numero: true, nome: true } },
      pagamento: true,
    },
  });

  return resposta(comanda ?? null);
}

// PATCH — solicita pagamento da comanda
export async function PATCH(req: NextRequest) {
  const { user, cliente } = await getWebSession();
  if (!user || !cliente) return erroResposta("Não autenticado", 401);

  const body    = await req.json().catch(function () { return {}; });
  const pedidoId = body.pedidoId as string | undefined;
  if (!pedidoId) return erroResposta("pedidoId obrigatório");

  try {
    const pedido = await prisma.pedido.update({
      where: { id: pedidoId, clienteId: cliente.id, status: "COMANDA_ABERTA" },
      data:  { status: "AGUARDANDO_PAGAMENTO" },
      include: { itens: { include: { produto: true } } },
    });

    await supabaseAdmin.channel(`empresa-${EMPRESA_ID}`).send({
      type:    "broadcast",
      event:   "pedido:atualizado",
      payload: { id: pedido.id, status: pedido.status, senha: pedido.senha },
    });

    return resposta(pedido);
  } catch {
    return erroResposta("Comanda não encontrada ou já encerrada", 404);
  }
}
