import { getWebSession } from "@/lib/web-auth";
import { resposta, erroResposta } from "@/lib/api-response";

export async function GET() {
  const { user, cliente } = await getWebSession();
  if (!user) return erroResposta("Não autenticado", 401);

  return resposta({
    supabaseId:   user.id,
    email:        user.email ?? "",
    clienteId:    cliente?.id ?? null,
    nome:         cliente?.nome ?? (user.user_metadata?.full_name as string | undefined) ?? "",
    whatsapp:     cliente?.whatsapp ?? null,
    totalVisitas: cliente?.totalVisitas ?? 0,
    totalGasto:   cliente ? Number(cliente.totalGasto) : 0,
  });
}
