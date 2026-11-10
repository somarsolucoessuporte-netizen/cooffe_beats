import { z } from "zod";
import { obterDevicePoint } from "@/lib/mercadopago";
import { estruturaPronta, habilitada } from "@/lib/dividir-conta/database";
import { DivisaoError } from "@/lib/dividir-conta/domain";
import { divisao } from "@/lib/dividir-conta/runtime";
import { respostaDivisao, tokenRequest, tratar } from "@/lib/dividir-conta/http";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  return tratar(async () => {
    if (!habilitada()) throw new DivisaoError("Novas cobranças desativadas", 403);
    if (!await estruturaPronta()) throw new DivisaoError("Divisão indisponível", 503);
    const valid = z.object({ parcelaId: z.string().uuid(), chave: z.string().uuid() }).safeParse(await req.json().catch(() => null));
    if (!valid.success) throw new DivisaoError("Parcela inválida", 400);
    const { id } = await context.params;
    const token = tokenRequest(req);
    await divisao.resumo(id, token); // authenticate BEFORE contacting Mercado Pago
    const device = await obterDevicePoint();
    return respostaDivisao(await divisao.cobrar(id, token, valid.data.parcelaId, valid.data.chave, device));
  });
}
