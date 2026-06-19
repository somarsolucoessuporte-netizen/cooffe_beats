import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resposta, erroResposta } from "@/lib/api-response";

// Endpoint interno preparado para futura integração com iFood, 99Food, Uber Eats.
// NÃO exposto publicamente — apenas para testes internos e futura ligação com webhooks reais.
// Ver docs/INTEGRACAO_DELIVERY.md para o roteiro de homologação.

const ItemExternoSchema = z.object({
  nome:       z.string(),
  quantidade: z.number().int().positive(),
  preco:      z.number().positive(),
  observacao: z.string().optional(),
});

const PedidoExternoSchema = z.object({
  canalOrigem:      z.enum(["ifood", "99food", "ubereats"]),
  pedidoExternoId:  z.string(),
  cliente: z.object({
    nome:     z.string(),
    telefone: z.string(),
  }),
  itens:           z.array(ItemExternoSchema).min(1),
  total:           z.number().positive(),
  enderecoEntrega: z.unknown().optional(),
});

const CANAL_SLUG: Record<string, string> = {
  ifood:     "iFood",
  "99food":  "99Food",
  ubereats:  "Uber Eats",
};

export async function POST(req: NextRequest) {
  // Requer autenticação admin para simular recebimento de pedido externo
  const { erro, empresaId } = await getAdminSession(["ADMIN"]);
  if (erro) return erro;

  try {
    const body = await req.json();
    const v    = PedidoExternoSchema.safeParse(body);
    if (!v.success) return erroResposta(v.error.message);

    const { canalOrigem, cliente, itens, total } = v.data;
    const nomeCanalBuscado = CANAL_SLUG[canalOrigem];

    const canal = await prisma.canalVenda.findFirst({ where: { nome: nomeCanalBuscado } });
    if (!canal) return erroResposta("Canal de venda não encontrado no banco", 400);

    const config = await prisma.configuracao.findUnique({ where: { empresaId } });
    if (!config) return erroResposta("Configuração da empresa não encontrada", 500);

    const novaSenha = config.senhaAtual + 1;
    await prisma.configuracao.update({ where: { empresaId }, data: { senhaAtual: novaSenha } });

    const senha = `${config.prefixoSenha}-${novaSenha}`;

    // Para itens externos, não há produtoId local — criamos um pedido sem itens Prisma reais
    // e armazenamos os itens no campo observacao (JSON).
    // Quando a integração real for ativada, haverá mapeamento produto_externo→produto_local.
    const pedido = await prisma.pedido.create({
      data: {
        empresaId,
        senha,
        status:      "RECEBIDO",
        origem:      "APP",
        subtotal:    total,
        total,
        observacao:  `[${nomeCanalBuscado}] ${cliente.nome} | ${JSON.stringify(itens.map((i) => `${i.quantidade}x ${i.nome}`))}`,
        canalVendaId: canal.id,
      },
    });

    await supabaseAdmin.channel(`empresa-${empresaId}`).send({
      type:    "broadcast",
      event:   "pedido:novo",
      payload: pedido,
    });

    return resposta({ pedido, simulado: true }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao processar pedido externo";
    return erroResposta(msg, 500);
  }
}
