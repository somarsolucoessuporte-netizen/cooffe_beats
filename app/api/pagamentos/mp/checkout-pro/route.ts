import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWebSession } from "@/lib/web-auth";
import { resposta, erroResposta } from "@/lib/api-response";
import { criarPreferenciaCheckoutPro } from "@/lib/mercadopago";
import { calcularCarrinhoWeb } from "@/lib/carrinho-web";
import type { ItemSessao } from "@/lib/checkout-sessao";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";
const BASE_URL   = process.env.NEXT_PUBLIC_BASE_URL   ?? "https://coffeebeats.somar.ia.br";

const ItemSchema = z.object({
  produtoId:  z.string(),
  quantidade: z.number().int().positive(),
  adicionais: z.array(z.object({ adicionalId: z.string() })).optional(),
});

const Schema = z.object({
  itens:           z.array(ItemSchema).min(1),
  previsaoChegada: z.string().min(1),     // ISO datetime
  cupomId:         z.string().optional(),
});

/**
 * POST /api/pagamentos/mp/checkout-pro
 * Pedido online pago antecipadamente pelo Checkout Pro do Mercado Pago.
 * Mesmo fluxo do SumUp online: cria só a CheckoutSessao — o pedido nasce pago
 * quando o webhook confirma (lib/checkout-sessao.ts), nunca antes.
 * Preços e cupom são recalculados aqui; o valor enviado pelo navegador é ignorado.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, cliente } = await getWebSession();
    if (!user || !cliente) return erroResposta("Não autenticado", 401);

    const valid = Schema.safeParse(await req.json().catch(() => null));
    if (!valid.success) return erroResposta("Dados inválidos");
    const { itens, previsaoChegada, cupomId } = valid.data;

    const carrinho = await calcularCarrinhoWeb(EMPRESA_ID, itens, cupomId);
    if ("erro" in carrinho) return erroResposta(carrinho.erro);

    const itensSessao: ItemSessao[] = carrinho.itens.map((i) => ({
      produtoId: i.produtoId, nome: i.nome, preco: i.preco, quantidade: i.quantidade, adicionais: i.adicionais,
    }));
    const { desconto, total } = carrinho;
    if (total <= 0) return erroResposta("Total inválido para pagamento online");

    const expiraEm = new Date(Date.now() + 30 * 60 * 1000);
    const sessao = await prisma.checkoutSessao.create({
      data: {
        clienteId:       cliente.id,
        empresaId:       EMPRESA_ID,
        itensJson:       itensSessao,
        total,
        previsaoChegada: new Date(previsaoChegada),
        provedor:        "MERCADOPAGO",
        cupomId:         desconto > 0 ? cupomId : null,
        valorDesconto:   desconto > 0 ? desconto : null,
        status:          "PENDENTE",
        expiresAt:       expiraEm,
      },
    });

    // Com desconto, o Mercado Pago não aceita item negativo: vai um item único com o total
    const itensPreferencia = desconto > 0
      ? [{ id: sessao.id, titulo: "Pedido Coffee & Beats", quantidade: 1, precoUnit: total }]
      : itensSessao.map((i) => ({ id: i.produtoId, titulo: i.nome, quantidade: i.quantidade, precoUnit: i.preco }));

    const preferencia = await criarPreferenciaCheckoutPro({
      referencia: sessao.id,
      itens:      itensPreferencia,
      urlRetorno: `${BASE_URL}/web/pedido/confirmacao?sessao=${sessao.id}`,
      urlWebhook: `${BASE_URL}/api/pagamentos/mp/webhook`,
      expiraEm,
    });

    return resposta({ checkoutUrl: preferencia.checkoutUrl, sessaoId: sessao.id }, 201);
  } catch (err) {
    console.error("[MP Checkout Pro]", err);
    return erroResposta(err instanceof Error ? err.message : "Erro ao iniciar pagamento", 500);
  }
}
