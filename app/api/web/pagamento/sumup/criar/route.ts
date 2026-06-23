import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getWebSession } from "@/lib/web-auth";
import { resposta, erroResposta } from "@/lib/api-response";
import { getSumupConfigDb, getSumupToken, criarSumupCheckout } from "@/lib/sumup-web";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";
const BASE_URL   = process.env.NEXT_PUBLIC_BASE_URL   ?? "https://coffeebeats.somar.ia.br";

const ItemSchema = z.object({
  produtoId:  z.string(),
  nome:       z.string(),
  preco:      z.number().positive(),
  quantidade: z.number().int().positive(),
  fotoUrl:    z.string().nullable().optional(),
});

const Schema = z.object({
  itens:           z.array(ItemSchema).min(1),
  total:           z.number().positive(),
  previsaoChegada: z.string().min(1),     // ISO datetime
  cupomId:         z.string().optional(),
  valorDesconto:   z.number().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { user, cliente } = await getWebSession();
    if (!user || !cliente) return erroResposta("Não autenticado", 401);

    const body  = await req.json();
    const valid = Schema.safeParse(body);
    if (!valid.success) return erroResposta(valid.error.message);

    const { itens, total, previsaoChegada } = valid.data;

    // 1. Busca credenciais SumUp — lança erro se não configurado
    const sumupConfig = await getSumupConfigDb();

    // 2. Cria sessão de checkout no banco
    const sessao = await prisma.checkoutSessao.create({
      data: {
        clienteId:       cliente.id,
        empresaId:       EMPRESA_ID,
        itensJson:       itens,
        total,
        previsaoChegada: new Date(previsaoChegada),
        status:          "PENDENTE",
        expiresAt:       new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    // 3. Obtém token SumUp
    const token = await getSumupToken(sumupConfig.clientId, sumupConfig.clientSecret);

    // 4. Cria checkout na API SumUp
    const checkout = await criarSumupCheckout({
      token,
      merchantCode: sumupConfig.merchantCode,
      sessaoId:     sessao.id,
      total:        Number(sessao.total),
      returnUrl:    `${BASE_URL}/web/pedido/confirmacao?sessao=${sessao.id}`,
    });

    // 5. Persiste ID do checkout SumUp na sessão
    await prisma.checkoutSessao.update({
      where: { id: sessao.id },
      data:  { sumupCheckoutId: checkout.id },
    });

    const checkoutUrl = checkout.checkout_url ??
      `https://pay.sumup.com/b2c/pay?checkout_id=${checkout.id}`;

    return resposta({ checkoutUrl, sessaoId: sessao.id }, 201);
  } catch (err) {
    return erroResposta(err instanceof Error ? err.message : "Erro ao iniciar pagamento", 500);
  }
}
