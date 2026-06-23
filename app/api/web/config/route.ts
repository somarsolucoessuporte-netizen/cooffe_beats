import { prisma } from "@/lib/prisma";
import { resposta } from "@/lib/api-response";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";

// Configurações públicas (sem credenciais) para o portal web
export async function GET() {
  const config = await prisma.configuracao.findUnique({
    where:  { empresaId: EMPRESA_ID },
    select: { tempoMedioMinutos: true, sumupOnlineAtivo: true },
  });

  return resposta({
    tempoMedioMinutos: config?.tempoMedioMinutos ?? 30,
    sumupOnlineAtivo:  config?.sumupOnlineAtivo  ?? false,
  });
}
