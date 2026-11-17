import { z } from "zod";
import { estruturaPronta } from "@/lib/dividir-conta/database";
import { DivisaoError } from "@/lib/dividir-conta/domain";
import { divisao, notificarQuitadas } from "@/lib/dividir-conta/runtime";
import { respostaDivisao, tokenRequest, tratar } from "@/lib/dividir-conta/http";

/** Atendente confirma o Pix estático (chave CNPJ) recebido para a parcela. Valor sempre o da parcela no banco. */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  return tratar(async () => {
    if (!await estruturaPronta()) throw new DivisaoError("Divisão indisponível", 503);
    const valid = z.object({ parcelaId: z.string().uuid(), chave: z.string().uuid() }).safeParse(await req.json().catch(() => null));
    if (!valid.success) throw new DivisaoError("Parcela inválida", 400);
    const { id } = await context.params;
    const data = await divisao.confirmarPixManual(id, tokenRequest(req), valid.data.parcelaId, valid.data.chave);
    await notificarQuitadas().catch(() => {});
    return respostaDivisao(data);
  });
}
