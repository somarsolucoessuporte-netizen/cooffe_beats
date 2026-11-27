/** Conciliação do botão "Já paguei na maquininha": procura o pagamento aprovado no Mercado Pago. */
import { MercadoPagoConfig, Payment } from "mercadopago";
import type { MetodoPagamento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { db, estruturaPronta } from "@/lib/dividir-conta/database";
import { metodoDoMp } from "@/lib/metodos-pagamento";

const JANELA_MIN = 15;

export type CandidatoMp = {
  paymentId: string; tipo: string; metodo: MetodoPagamento | undefined; referencia: string; aprovadoEm: string;
};

/** A referência ou o id já pertencem a outro pedido, parcela ou compra online? */
async function pertenceAOutro(pedidoId: string, paymentId: string, referencia: string) {
  const outro = await prisma.pagamento.findFirst({
    where: {
      pedidoId: { not: pedidoId },
      OR: [{ payload: { path: ["paymentId"], equals: paymentId } }, ...(referencia ? [{ referencia }] : [])],
    },
    select: { id: true },
  });
  if (outro) return true;
  if (referencia && await prisma.checkoutSessao.findUnique({ where: { id: referencia }, select: { id: true } })) return true;
  if (!await estruturaPronta()) return false;
  const parcelas = await db.query(`SELECT id FROM "TentativaParcela" WHERE "paymentId"=$1 OR referencia=$2 LIMIT 1`, [paymentId, referencia]);
  return parcelas.length > 0;
}

/**
 * Pagamentos aprovados do mesmo valor nos últimos 15 min que ainda não pertencem a ninguém.
 * Primeiro o da própria referência; depois do mais recente ao mais antigo. Lança se o MP não responder.
 */
export async function procurarPagamentoRecente(pedidoId: string, valor: number, referencia: string | null): Promise<CandidatoMp[]> {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Mercado Pago indisponível");
  const mp = new Payment(new MercadoPagoConfig({ accessToken, options: { timeout: 8000, maxRetries: 0 } }));
  const agora = Date.now();
  const limite = agora - JANELA_MIN * 60000;
  // Criação com folga: o que conta é o horário da aprovação
  const res = await mp.search({ options: {
    sort: "date_created", criteria: "desc", range: "date_created", status: "approved", limit: 100,
    begin_date: new Date(limite - 60 * 60000).toISOString(), end_date: new Date(agora + 60000).toISOString(),
  } });

  const candidatos: CandidatoMp[] = [];
  for (const p of res.results ?? []) {
    const aprovado = p.date_approved ?? p.date_created ?? "";
    if (!p.id || p.status !== "approved" || Number(p.transaction_amount_refunded) > 0) continue;
    if (Math.round(Number(p.transaction_amount) * 100) !== Math.round(valor * 100)) continue;
    if (new Date(aprovado).getTime() < limite) continue;
    const paymentId = String(p.id), ref = p.external_reference ?? "";
    if (await pertenceAOutro(pedidoId, paymentId, ref)) continue;
    const tipo = p.payment_type_id ?? "";
    candidatos.push({
      paymentId, tipo, referencia: ref, aprovadoEm: aprovado,
      // Saldo em conta é pago pelo QR: entra como Pix
      metodo: tipo === "account_money" ? "PIX" : metodoDoMp(tipo),
    });
  }
  return candidatos.sort((a, b) => Number(b.referencia === referencia) - Number(a.referencia === referencia));
}
