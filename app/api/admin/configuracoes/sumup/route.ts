import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { resposta, erroResposta } from "@/lib/api-response";

const EMPRESA_ID = process.env.NEXT_PUBLIC_EMPRESA_ID ?? "";
const MASKED     = "••configurado";

// GET — retorna config mascarada (segredos nunca expostos ao frontend)
export async function GET() {
  const { erro } = await getAdminSession(["ADMIN"]);
  if (erro) return erro;

  const config = await prisma.configuracao.findUnique({
    where:  { empresaId: EMPRESA_ID },
    select: {
      sumupClientId:     true,
      sumupClientSecret: true,
      sumupMerchantCode: true,
      sumupAffiliateKey: true,
      sumupOnlineAtivo:  true,
    },
  });

  return resposta({
    sumupClientId:     config?.sumupClientId     ? MASKED : "",
    sumupClientSecret: config?.sumupClientSecret ? MASKED : "",
    sumupMerchantCode: config?.sumupMerchantCode ?? "",
    sumupAffiliateKey: config?.sumupAffiliateKey ?? "",
    sumupOnlineAtivo:  config?.sumupOnlineAtivo  ?? false,
    configurado:       !!(config?.sumupClientId && config?.sumupClientSecret && config?.sumupMerchantCode),
  });
}

// PUT — salva credenciais (ignora campos que ainda têm valor mascarado)
export async function PUT(req: NextRequest) {
  const { erro } = await getAdminSession(["ADMIN"]);
  if (erro) return erro;

  const body = await req.json() as Record<string, unknown>;
  const update: Record<string, unknown> = {};

  // Campos de texto: só atualiza se o usuário enviou um valor real (não mascarado)
  for (const key of ["sumupClientId", "sumupClientSecret", "sumupMerchantCode", "sumupAffiliateKey"] as const) {
    const val = body[key];
    if (typeof val === "string" && val.trim() && !val.startsWith("••")) {
      update[key] = val.trim();
    } else if (typeof val === "string" && val.trim() === "") {
      update[key] = null; // limpar campo
    }
  }

  if (typeof body.sumupOnlineAtivo === "boolean") {
    // Só ativa se credenciais estiverem configuradas
    if (body.sumupOnlineAtivo) {
      const config = await prisma.configuracao.findUnique({ where: { empresaId: EMPRESA_ID } });
      const temCredenciais = !!(
        (update.sumupClientId      || config?.sumupClientId)     &&
        (update.sumupClientSecret  || config?.sumupClientSecret) &&
        (update.sumupMerchantCode  || config?.sumupMerchantCode)
      );
      if (!temCredenciais) return erroResposta("Configure Client ID, Secret e Merchant Code antes de ativar.");
    }
    update.sumupOnlineAtivo = body.sumupOnlineAtivo;
  }

  if (Object.keys(update).length === 0) return resposta({ ok: true, mensagem: "Nada alterado" });

  await prisma.configuracao.update({ where: { empresaId: EMPRESA_ID }, data: update });
  return resposta({ ok: true });
}

// POST — testa conexão com credenciais enviadas (nunca armazena)
export async function POST(req: NextRequest) {
  const { erro } = await getAdminSession(["ADMIN"]);
  if (erro) return erro;

  const body = await req.json() as { clientId?: string; clientSecret?: string };

  // Usa credenciais enviadas ou busca do banco se mascaradas
  let { clientId, clientSecret } = body;
  if (!clientId || clientId.startsWith("••") || !clientSecret || clientSecret.startsWith("••")) {
    const config = await prisma.configuracao.findUnique({ where: { empresaId: EMPRESA_ID } });
    clientId     = clientId?.startsWith("••")     ? (config?.sumupClientId     ?? "") : (clientId     ?? "");
    clientSecret = clientSecret?.startsWith("••") ? (config?.sumupClientSecret ?? "") : (clientSecret ?? "");
  }

  if (!clientId || !clientSecret) return erroResposta("Informe Client ID e Client Secret para testar.");

  try {
    const res = await fetch("https://api.sumup.com/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
    });
    const data = await res.json() as { access_token?: string; error_description?: string };
    if (data.access_token) return resposta({ sucesso: true, mensagem: "Conexão SumUp OK ✓" });
    return erroResposta(data.error_description ?? "Credenciais inválidas");
  } catch {
    return erroResposta("Erro ao conectar com a API SumUp");
  }
}
