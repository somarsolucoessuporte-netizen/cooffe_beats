import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

// POST — upsert cliente por whatsapp+empresaId (chamado pelo totem, sem auth)
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return erroResposta("Body inválido");

  const { empresaId, nome, whatsapp } = body as {
    empresaId?: string;
    nome?: string;
    whatsapp?: string;
  };

  if (!empresaId || !nome || !whatsapp) {
    return erroResposta("empresaId, nome e whatsapp são obrigatórios");
  }

  const wppLimpo = whatsapp.replace(/\D/g, "");
  if (wppLimpo.length < 10) return erroResposta("WhatsApp inválido");

  const cliente = await prisma.cliente.upsert({
    where: { empresaId_whatsapp: { empresaId, whatsapp: wppLimpo } },
    update: {
      nome,
      totalVisitas: { increment: 1 },
      ultimaVisita: new Date(),
    },
    create: {
      empresaId,
      nome,
      whatsapp: wppLimpo,
    },
  });

  return resposta(cliente, 200);
}

// GET — lista clientes (ADMIN/GERENTE)
export async function GET(req: Request) {
  const { erro, empresaId } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;

  const { searchParams } = new URL(req.url);
  const filtro = searchParams.get("filtro") ?? "gasto"; // gasto | visitas | recentes | inativos

  const orderBy =
    filtro === "visitas" ? { totalVisitas: "desc" as const } :
    filtro === "recentes" ? { ultimaVisita: "desc" as const } :
    filtro === "inativos" ? { ultimaVisita: "asc" as const } :
    { totalGasto: "desc" as const };

  const clientes = await prisma.cliente.findMany({
    where: { empresaId },
    orderBy,
    include: {
      _count: { select: { pedidos: true } },
    },
  });

  return resposta(clientes);
}
