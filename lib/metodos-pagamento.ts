/** Categorias de recebimento, iguais no fechamento, Relatório do Dia, Dashboard e exportação. Puro. */
import type { MetodoPagamento } from "@prisma/client";

/** payment_type_id do Mercado Pago → método do sistema. undefined = não mudar o que está gravado. */
export function metodoDoMp(tipo: string | undefined | null): MetodoPagamento | undefined {
  if (tipo === "bank_transfer") return "PIX";
  if (tipo === "debit_card") return "CARTAO_DEBITO";
  if (tipo === "credit_card") return "CARTAO_CREDITO";
  if (tipo === "prepaid_card") return "CARTAO_PREPAGO";
  return undefined;
}

/** Marca em Pagamento.payload.conciliacao de confirmações manuais. */
export const SEM_CONCILIACAO = "manual_sem_conciliacao";

export type PedidoRecebido = {
  total: unknown;
  pagamento?: { metodo: string; status: string; payload?: unknown } | null;
};

/** Soma pedidos com pagamento APROVADO por categoria (conta dividida é somada à parte). */
export function somarPorMetodo(pedidos: PedidoRecebido[]) {
  const s = { dinheiro: 0, credito: 0, debito: 0, prepago: 0, pixQr: 0, pixCnpj: 0, semConciliacao: 0, qtdSemConciliacao: 0 };
  for (const p of pedidos) {
    const pg = p.pagamento;
    if (!pg || pg.status !== "APROVADO") continue;
    const total = Number(p.total);
    const extra = pg.payload as { origem?: string; conciliacao?: string } | null | undefined;
    if (pg.metodo === "DINHEIRO") s.dinheiro += total;
    else if (pg.metodo === "CARTAO_CREDITO") s.credito += total;
    else if (pg.metodo === "CARTAO_DEBITO") s.debito += total;
    else if (pg.metodo === "CARTAO_PREPAGO") s.prepago += total;
    else if (pg.metodo === "PIX") { if (extra?.origem === "PIX_CNPJ_ESTATICO") s.pixCnpj += total; else s.pixQr += total; }
    if (extra?.conciliacao === SEM_CONCILIACAO) { s.semConciliacao += total; s.qtdSemConciliacao++; }
  }
  return s;
}
