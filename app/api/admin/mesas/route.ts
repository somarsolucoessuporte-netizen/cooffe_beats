import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://coffeebeats.somar.ia.br";

export async function GET() {
  const { erro, empresaId } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const mesas = await prisma.mesa.findMany({
    where: { empresaId },
    orderBy: { numero: "asc" },
    include: {
      _count: { select: { pedidos: true } },
      pedidos: {
        where: { status: "COMANDA_ABERTA" },
        select: { total: true },
      },
    },
  });

  const resultado = mesas.map(function(m) {
    const comandaTotal = m.pedidos.reduce(function(sum, p) { return sum + Number(p.total); }, 0);
    const { pedidos: _, ...rest } = m;
    return { ...rest, comandaTotal };
  });

  return resposta(resultado);
}

export async function POST(req: Request) {
  const { erro, empresaId } = await getAdminSession(["ADMIN"]);
  if (erro) return erro;

  const body = await req.json().catch(() => ({}));
  const numero = Number(body.numero);
  if (!numero || numero < 1) return erroResposta("Número da mesa inválido");

  const existente = await prisma.mesa.findFirst({ where: { empresaId, numero } });
  if (existente) return erroResposta("Já existe uma mesa com esse número", 409);

  const mesa = await prisma.mesa.create({
    data: {
      empresaId,
      numero,
      nome: body.nome ?? `Mesa ${numero}`,
      ativo: true,
    },
  });

  // Gerar QR Code URL
  const url = `${BASE}/mesa/${mesa.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;

  const mesaAtualizada = await prisma.mesa.update({
    where: { id: mesa.id },
    data: { qrCode: qrUrl },
  });

  return resposta(mesaAtualizada, 201);
}
