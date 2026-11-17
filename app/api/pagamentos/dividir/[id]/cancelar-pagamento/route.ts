import { divisao } from "@/lib/dividir-conta/runtime";
import { respostaDivisao, tokenRequest, tratar } from "@/lib/dividir-conta/http";

/** "Cancelar esse pagamento": cancela no MP (Point e order QR) as tentativas ativas e libera as parcelas. */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  return tratar(async () => {
    const { id } = await context.params;
    return respostaDivisao(await divisao.cancelarPagamento(id, tokenRequest(req)));
  });
}
