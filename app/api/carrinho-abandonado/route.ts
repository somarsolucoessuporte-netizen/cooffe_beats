import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

const SalvarSchema = z.object({
  empresaId:     z.string(),
  nomeCliente:   z.string().optional(),
  telefone:      z.string().optional(),
  mesaId:        z.string().optional(),
  itensJson:     z.array(z.unknown()),
  totalEstimado: z.number(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const v    = SalvarSchema.safeParse(body);
    if (!v.success) return erroResposta("Dados inválidos");

    if (v.data.itensJson.length === 0) return resposta({ ignorado: true });

    const registro = await prisma.carrinhoAbandonado.create({
      data: {
        empresaId:     v.data.empresaId,
        nomeCliente:   v.data.nomeCliente ?? null,
        telefone:      v.data.telefone    ?? null,
        mesaId:        v.data.mesaId      ?? null,
        itensJson:     v.data.itensJson as never,
        totalEstimado: v.data.totalEstimado,
      },
    });

    return resposta(registro, 201);
  } catch {
    return erroResposta("Erro ao salvar carrinho", 500);
  }
}

export async function GET(req: NextRequest) {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const recuperado = req.nextUrl.searchParams.get("recuperado");

  try {
    const registros = await prisma.carrinhoAbandonado.findMany({
      where: recuperado !== null ? { recuperado: recuperado === "true" } : undefined,
      orderBy: { criadoEm: "desc" },
      take: 100,
    });
    return resposta(registros);
  } catch {
    return erroResposta("Erro ao buscar carrinhos", 500);
  }
}

export async function PATCH(req: NextRequest) {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  try {
    const { id } = await req.json();
    const r = await prisma.carrinhoAbandonado.update({
      where: { id },
      data:  { recuperado: true },
    });
    return resposta(r);
  } catch {
    return erroResposta("Erro ao marcar recuperado", 500);
  }
}
