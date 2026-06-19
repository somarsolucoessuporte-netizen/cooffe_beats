import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

const CriarCupomSchema = z.object({
  codigo:       z.string().min(2).transform((s) => s.toUpperCase()),
  tipo:         z.enum(["percentual", "valor_fixo"]),
  valor:        z.number().positive(),
  usoMaximo:    z.number().int().positive().optional().nullable(),
  validoAte:    z.string().optional().nullable(),
  pedidoMinimo: z.number().positive().optional().nullable(),
});

export async function GET() {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  try {
    const cupons = await prisma.cupom.findMany({ orderBy: { criadoEm: "desc" } });
    return resposta(cupons);
  } catch {
    return erroResposta("Erro ao buscar cupons", 500);
  }
}

export async function POST(req: NextRequest) {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  try {
    const body = await req.json();
    const v    = CriarCupomSchema.safeParse(body);
    if (!v.success) return erroResposta(v.error.message);

    const { codigo, tipo, valor, usoMaximo, validoAte, pedidoMinimo } = v.data;

    const existe = await prisma.cupom.findUnique({ where: { codigo } });
    if (existe) return erroResposta("Código já em uso", 409);

    const cupom = await prisma.cupom.create({
      data: {
        codigo,
        tipo,
        valor,
        usoMaximo:    usoMaximo ?? null,
        validoAte:    validoAte ? new Date(validoAte) : null,
        pedidoMinimo: pedidoMinimo ?? null,
      },
    });

    return resposta(cupom, 201);
  } catch {
    return erroResposta("Erro ao criar cupom", 500);
  }
}
