import { estruturaPronta } from "@/lib/dividir-conta/database";
import { DivisaoError } from "@/lib/dividir-conta/domain";
import { divisao, notificarQuitadas } from "@/lib/dividir-conta/runtime";
import { respostaDivisao, tokenRequest, tratar } from "@/lib/dividir-conta/http";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  return tratar(async () => {
    if (!await estruturaPronta()) throw new DivisaoError("Conta indisponível", 503);
    const { id } = await context.params;
    const data = await divisao.reconciliar(id, tokenRequest(req));
    await notificarQuitadas().catch(() => {});
    return respostaDivisao(data);
  });
}
