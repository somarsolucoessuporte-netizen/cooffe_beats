import { prisma } from "@/lib/prisma";
import { resposta, erroResposta } from "@/lib/api-response";

// Chamado pelo N8N via cron — autenticado por API key simples no header
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Autenticação: N8N envia header Authorization: Bearer <NEXTAUTH_SECRET>
  const auth  = req.headers.get("authorization") ?? "";
  const token = auth.replace("Bearer ", "");
  if (token !== process.env.NEXTAUTH_SECRET) {
    return erroResposta("Não autorizado", 401);
  }

  const empresaId = searchParams.get("empresaId");
  if (!empresaId) return erroResposta("empresaId obrigatório");

  const dias = Number(searchParams.get("dias") ?? "3");
  if (isNaN(dias) || dias < 1) return erroResposta("dias deve ser >= 1");

  const limite = new Date();
  limite.setDate(limite.getDate() - dias);

  const clientes = await prisma.cliente.findMany({
    where: {
      empresaId,
      ultimaVisita: { lt: limite },
    },
    orderBy: { ultimaVisita: "asc" },
    select: {
      id:          true,
      nome:        true,
      whatsapp:    true,
      totalVisitas: true,
      totalGasto:  true,
      ultimaVisita: true,
      pedidos: {
        orderBy: { criadoEm: "desc" },
        take: 3,
        include: {
          itens: { include: { produto: { select: { nome: true } } } },
        },
      },
    },
  });

  const resultado = clientes.map(c => ({
    id:           c.id,
    nome:         c.nome,
    whatsapp:     c.whatsapp,
    totalVisitas: c.totalVisitas,
    totalGasto:   Number(c.totalGasto),
    ultimaVisita: c.ultimaVisita,
    produtoFavorito: c.pedidos[0]?.itens[0]?.produto.nome ?? null,
  }));

  return resposta(resultado);
}
