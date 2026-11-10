import { getAdminSession } from "@/lib/admin-auth";
import { recuperarDivisoes } from "@/lib/dividir-conta/runtime";
import { respostaDivisao, tratar } from "@/lib/dividir-conta/http";

// Manual/scheduled POST authenticated as staff. No creation feature flag here.
export async function POST() {
  const { erro } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;
  return tratar(async () => { await recuperarDivisoes(); return respostaDivisao({ recuperado: true }); });
}
