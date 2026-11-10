import { z } from "zod";
import { calcularCarrinhoWeb } from "@/lib/carrinho-web";
import { db, estruturaPronta, habilitada } from "@/lib/dividir-conta/database";
import { DivisaoError } from "@/lib/dividir-conta/domain";
import { divisao } from "@/lib/dividir-conta/runtime";
import { respostaDivisao, tokenRequest, tratar } from "@/lib/dividir-conta/http";

const schema = z.object({
  valores: z.array(z.number().int().positive()).min(2).max(20),
  itens: z.array(z.object({ produtoId: z.string().min(1), quantidade: z.number().int().positive().max(100), observacao: z.string().max(500).optional(), adicionais: z.array(z.object({ adicionalId: z.string() })).max(30).optional() })).min(1).max(100),
  clienteId: z.string().optional(), mesaId: z.string().optional(), cupomId: z.string().optional(),
});

export async function POST(req: Request) {
  return tratar(async () => {
    if (!await estruturaPronta()) throw new DivisaoError("Divisão ainda não preparada", 503);
    const valid = schema.safeParse(await req.json().catch(() => null));
    if (!valid.success) throw new DivisaoError("Itens ou parcelas inválidos", 400);
    const empresaId = process.env.NEXT_PUBLIC_EMPRESA_ID;
    if (!empresaId) throw new DivisaoError("Empresa indisponível", 503);
    const input = valid.data;
    const token = tokenRequest(req);
    // A retry after a lost response must recover the original order even if prices changed.
    const { hashToken } = await import("@/lib/dividir-conta/service");
    if (/^[a-f0-9]{64}$/.test(token)) {
      const [existing] = await db.query<{ id: string; requestHash: string }>(`SELECT id,"requestHash" FROM "ContaDividida" WHERE "criacaoHash"=$1 OR "tokenHash"=$1`, [hashToken(token)]);
      if (existing) {
        if (existing.requestHash !== hashToken(JSON.stringify(input))) throw new DivisaoError("Chave reutilizada com dados diferentes");
        return respostaDivisao(await divisao.resumo(existing.id, token));
      }
    }
    if (!habilitada()) throw new DivisaoError("Divisão de conta desativada", 403);
    const carrinho = await calcularCarrinhoWeb(empresaId, input.itens, input.cupomId);
    if ("erro" in carrinho) throw new DivisaoError(carrinho.erro, 400);
    const id = await divisao.criar({ ...input, empresaId, token, requestHash: hashToken(JSON.stringify(input)), itens: carrinho.itens, total: carrinho.total, subtotal: carrinho.subtotal, cupomId: carrinho.cupomId, desconto: carrinho.desconto });
    return respostaDivisao(await divisao.resumo(id, token), 201);
  });
}
