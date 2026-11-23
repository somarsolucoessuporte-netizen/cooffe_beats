import { prisma } from "@/lib/prisma";
import { db, estruturaPronta } from "@/lib/dividir-conta/database";
import { divisao } from "@/lib/dividir-conta/runtime";
import { lock } from "@/lib/dividir-conta/service";
import { recebimentosDivididos } from "@/lib/dividir-conta/relatorios";
import { cancelarPagamentoPoint, cancelarOrderMp } from "@/lib/mercadopago";

/** Pendência sem nenhum pagamento recebido e parada há mais que isto é considerada abandonada. */
const EXPIRA_MIN = 120;
/** Pagamento integral (Point / QR / Pix CNPJ) ainda aguardando há menos que isto é pendência ativa. */
const ATIVO_MIN = 30;

export type Pendencia = {
  tipo: "DIVISAO" | "PAGAMENTO";
  id: string;
  pedidoId: string;
  descricao: string;
  valor: number;
  pago: number;
  criadoEm: string;
  /** true = já há dinheiro recebido (não pode ser cancelada automaticamente) */
  temPagamento: boolean;
};

export type ResumoCaixa = {
  totalPedidos: number;
  totalVendas: number;
  totalDinheiro: number;
  totalCredito: number;
  totalDebito: number;
  totalPixQr: number;
  totalPixCnpj: number;
  totalPixDividido: number;
  totalCartaoDividido: number;
  totalPix: number;
  totalCartao: number;
  ticketMedio: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Totais do caixa a partir dos pagamentos APROVADOS (inclui Pix QR, Pix CNPJ manual e divisão de conta). */
export async function resumoCaixa(empresaId: string, caixaId: string): Promise<ResumoCaixa & { divisao: Awaited<ReturnType<typeof recebimentosDivididos>> }> {
  const pedidos = await prisma.pedido.findMany({
    where: { empresaId, caixaId, status: { notIn: ["CANCELADO", "AGUARDANDO_PAGAMENTO"] } },
    select: { total: true, pagamento: { select: { metodo: true, status: true, payload: true } } },
  });
  const div = await recebimentosDivididos(empresaId, { caixaId });

  let dinheiro = 0, credito = 0, debito = 0, pixQr = 0, pixCnpj = 0, vendas = 0;
  for (const p of pedidos) {
    const total = Number(p.total);
    vendas += total;
    const pg = p.pagamento;
    if (!pg || pg.status !== "APROVADO") continue;
    const origem = (pg.payload as { origem?: string } | null)?.origem;
    if (pg.metodo === "DINHEIRO") dinheiro += total;
    else if (pg.metodo === "CARTAO_CREDITO") credito += total;
    else if (pg.metodo === "CARTAO_DEBITO") debito += total;
    else if (pg.metodo === "PIX") { if (origem === "PIX_CNPJ_ESTATICO") pixCnpj += total; else pixQr += total; }
  }
  return {
    totalPedidos: pedidos.length,
    totalVendas: r2(vendas),
    totalDinheiro: r2(dinheiro),
    totalCredito: r2(credito),
    totalDebito: r2(debito),
    totalPixQr: r2(pixQr),
    totalPixCnpj: r2(pixCnpj),
    totalPixDividido: r2(div.totalPix),
    totalCartaoDividido: r2(div.totalCartao),
    totalPix: r2(pixQr + pixCnpj + div.totalPix),
    totalCartao: r2(credito + debito + div.totalCartao),
    ticketMedio: pedidos.length ? r2(vendas / pedidos.length) : 0,
    divisao: div,
  };
}

type LinhaConta = { id: string; pedidoId: string; total: number; status: string; criadoEm: Date; pago: number };

async function contasPendentes(caixaId: string): Promise<LinhaConta[]> {
  if (!await estruturaPronta()) return [];
  return db.query<LinhaConta>(`SELECT c.id, c."pedidoId", c.total, c.status, c."criadoEm",
      COALESCE((SELECT SUM(t.valor) FROM "TentativaParcela" t WHERE t."contaId"=c.id AND t.status='APROVADO'),0)::integer AS pago
    FROM "ContaDividida" c JOIN "Pedido" p ON p.id=c."pedidoId"
    WHERE p."caixaId"=$1 AND c.status NOT IN ('QUITADA','CANCELADA') ORDER BY c."criadoEm"`, [caixaId]);
}

const idadeMin = (d: Date | string) => (Date.now() - new Date(d).getTime()) / 60000;

/**
 * Libera sozinho as divisões abandonadas: sem nenhum pagamento aprovado e paradas há mais de 2 h.
 * Só muda status (conta → CANCELADA, pedido aguardando → CANCELADO, tentativas em aberto → RECUSADO). Nada é apagado.
 */
export async function liberarExpiradas(caixaId: string): Promise<number> {
  const contas = await contasPendentes(caixaId);
  let liberadas = 0;
  for (const c of contas) {
    if (c.pago > 0 || c.status !== "ABERTA" || idadeMin(c.criadoEm) < EXPIRA_MIN) continue;
    try {
      await db.transaction(async tx => {
        await lock(tx);
        const [x] = await tx.query<{ pago: number }>(`SELECT COALESCE(SUM(valor) FILTER (WHERE status IN ('APROVADO','REVISAO')),0)::integer AS pago FROM "TentativaParcela" WHERE "contaId"=$1`, [c.id]);
        if (x.pago > 0) return;
        await tx.query(`UPDATE "TentativaParcela" SET status='RECUSADO' WHERE "contaId"=$1 AND status IN ('CRIANDO','PENDENTE','DESCONHECIDO') RETURNING id`, [c.id]);
        await tx.query(`UPDATE "ContaDividida" SET status='CANCELADA' WHERE id=$1 AND status='ABERTA' RETURNING id`, [c.id]);
        await tx.query(`UPDATE "Pedido" SET status='CANCELADO',"atualizadoEm"=CURRENT_TIMESTAMP WHERE id=$1 AND status='AGUARDANDO_PAGAMENTO' RETURNING id`, [c.pedidoId]);
        liberadas++;
      });
    } catch (e) {
      console.warn("[Fechamento] não liberou divisão expirada", c.id, e instanceof Error ? e.message : e);
    }
  }
  return liberadas;
}

/** Pendências realmente ativas (divisões em aberto/revisão e pagamentos integrais aguardando). */
export async function listarPendencias(caixaId: string): Promise<Pendencia[]> {
  const lista: Pendencia[] = [];
  for (const c of await contasPendentes(caixaId)) {
    lista.push({
      tipo: "DIVISAO", id: c.id, pedidoId: c.pedidoId,
      descricao: c.status === "REVISAO" ? "Divisão de conta em revisão" : c.pago > 0 ? "Divisão de conta parcialmente paga" : "Divisão de conta em aberto",
      valor: c.total / 100, pago: c.pago / 100, criadoEm: new Date(c.criadoEm).toISOString(), temPagamento: c.pago > 0,
    });
  }
  const pagamentos = await prisma.pagamento.findMany({
    where: {
      status: "PENDENTE",
      criadoEm: { gt: new Date(Date.now() - ATIVO_MIN * 60000) },
      pedido: { caixaId, status: "AGUARDANDO_PAGAMENTO" },
    },
    select: { id: true, pedidoId: true, metodo: true, valor: true, criadoEm: true, pixOrderId: true },
  });
  for (const p of pagamentos) {
    lista.push({
      tipo: "PAGAMENTO", id: p.id, pedidoId: p.pedidoId,
      descricao: `Pagamento aguardando (${p.metodo === "PIX" ? "Pix" : p.metodo === "DINHEIRO" ? "Dinheiro" : "Cartão"})`,
      valor: Number(p.valor), pago: 0, criadoEm: p.criadoEm.toISOString(), temPagamento: false,
    });
  }
  return lista;
}

/** Cancela (no MP e no banco) as pendências ativas que ainda não receberam dinheiro. Nunca lança. */
export async function resolverPendencias(empresaId: string, caixaId: string) {
  for (const c of await contasPendentes(caixaId)) {
    if (c.pago > 0) continue;
    try {
      const { token } = await divisao.retomar(c.id, empresaId);
      await divisao.cancelar(c.id, token);
    } catch (e) {
      console.warn("[Fechamento] não cancelou divisão", c.id, e instanceof Error ? e.message : e);
    }
  }
  const pagamentos = await prisma.pagamento.findMany({
    where: { status: "PENDENTE", pedido: { caixaId, status: "AGUARDANDO_PAGAMENTO" } },
    select: { pedidoId: true, payload: true, pixOrderId: true },
  });
  for (const p of pagamentos) {
    try {
      const cancelado = await prisma.pedido.updateMany({ where: { id: p.pedidoId, status: "AGUARDANDO_PAGAMENTO" }, data: { status: "CANCELADO" } });
      if (cancelado.count === 0) continue;
      await prisma.pagamento.updateMany({ where: { pedidoId: p.pedidoId, status: "PENDENTE" }, data: { status: "CANCELADO" } });
      const mp = p.payload as { provider?: string; paymentIntentId?: string; deviceId?: string } | null;
      // Cancelamento no Mercado Pago com limite de tempo: nunca trava o fechamento
      const externos: Promise<unknown>[] = [];
      if (mp?.provider === "mercadopago" && mp.paymentIntentId && mp.deviceId) externos.push(cancelarPagamentoPoint(mp.deviceId, mp.paymentIntentId).catch(() => {}));
      if (p.pixOrderId) externos.push(cancelarOrderMp(p.pixOrderId).catch(() => {}));
      await Promise.race([Promise.allSettled(externos), new Promise(r => setTimeout(r, 5000))]);
    } catch (e) {
      console.warn("[Fechamento] não cancelou pagamento", p.pedidoId, e instanceof Error ? e.message : e);
    }
  }
}
