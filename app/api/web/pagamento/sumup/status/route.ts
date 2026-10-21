import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";
import { buscarPagamentoPorReferencia } from "@/lib/mercadopago";
import { aplicarPagamentoCheckoutPro } from "@/lib/mp-pagamento";

// Status da sessão de checkout online (SumUp ou Checkout Pro do Mercado Pago).
// Checkout Pro ainda pendente: reconsulta o pagamento na API do MP, para a tela
// de confirmação não depender só do webhook.
export async function GET(req: NextRequest) {
  const sessaoId = req.nextUrl.searchParams.get("sessao");
  if (!sessaoId) return erroResposta("Parâmetro sessao obrigatório");

  const select = { status: true, pedidoId: true, expiresAt: true, provedor: true } as const;
  let sessao = await prisma.checkoutSessao.findUnique({ where: { id: sessaoId }, select });

  if (!sessao) return erroResposta("Sessão não encontrada", 404);

  if (sessao.provedor === "MERCADOPAGO" && !sessao.pedidoId) {
    try {
      const resultado = await buscarPagamentoPorReferencia(sessaoId);
      if (resultado) {
        await aplicarPagamentoCheckoutPro(resultado);
        sessao = await prisma.checkoutSessao.findUnique({ where: { id: sessaoId }, select }) ?? sessao;
      }
    } catch (e) {
      console.warn("[Status sessão] consulta MP falhou:", e instanceof Error ? e.message : e);
    }
  }

  return resposta({
    status:   sessao.status,
    pedidoId: sessao.pedidoId,
    expirado: sessao.expiresAt < new Date(),
  });
}
