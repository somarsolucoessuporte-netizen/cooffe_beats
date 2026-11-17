import { divisao } from "@/lib/dividir-conta/runtime";
import { respostaDivisao, tokenRequest, tratar } from "@/lib/dividir-conta/http";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  return tratar(async () => {
    const { id } = await context.params;
    return respostaDivisao(await divisao.cancelar(id,tokenRequest(req)));
  });
}
