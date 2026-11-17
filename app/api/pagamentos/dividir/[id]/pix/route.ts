import { z } from "zod";
import { estruturaPronta, habilitada } from "@/lib/dividir-conta/database";
import { DivisaoError } from "@/lib/dividir-conta/domain";
import { divisao } from "@/lib/dividir-conta/runtime";
import { respostaDivisao, tokenRequest, tratar } from "@/lib/dividir-conta/http";

/** Parcela por Pix QR dinâmico na tela. O valor vem da parcela no banco — o corpo só traz ids. */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  return tratar(async () => {
    if (!habilitada()) throw new DivisaoError("Novas cobranças desativadas", 403);
    if (!await estruturaPronta()) throw new DivisaoError("Divisão indisponível", 503);
    const valid = z.object({ parcelaId: z.string().uuid(), chave: z.string().uuid() }).safeParse(await req.json().catch(() => null));
    if (!valid.success) throw new DivisaoError("Parcela inválida", 400);
    const { id } = await context.params;
    return respostaDivisao(await divisao.cobrarPix(id, tokenRequest(req), valid.data.parcelaId, valid.data.chave));
  });
}
