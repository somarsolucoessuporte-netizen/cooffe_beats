import { divisao } from "@/lib/dividir-conta/runtime";
import { respostaDivisao, tokenRequest, tratar } from "@/lib/dividir-conta/http";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  return tratar(async () => {
    const { id } = await context.params;
    await divisao.cancelar(id,tokenRequest(req));
    return respostaDivisao({ cancelada: true });
  });
}
