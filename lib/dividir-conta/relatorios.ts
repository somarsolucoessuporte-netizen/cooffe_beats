import { db, estruturaPronta } from "./database";

export async function recebimentosDivididos(empresaId: string, filtro: { caixaId?: string; inicio?: Date; fim?: Date }) {
  if (!await estruturaPronta()) return { totalPix: 0, totalCartao: 0, totalOutros: 0, totalRecebido: 0, pagamentos: [] };
  const pagamentos = await db.query<{ id: string; pedidoId: string; metodo: string; valorCentavos: number; aprovadoEm: Date }>(`SELECT t.id,c."pedidoId",t.metodo,t.valor AS "valorCentavos",t."aprovadoEm" FROM "TentativaParcela" t JOIN "ContaDividida" c ON c.id=t."contaId" JOIN "Pedido" p ON p.id=c."pedidoId" WHERE c."empresaId"=$1 AND t.status='APROVADO' AND ($2::text IS NULL OR p."caixaId"=$2) AND ($3::timestamp IS NULL OR t."aprovadoEm">=$3) AND ($4::timestamp IS NULL OR t."aprovadoEm"<=$4) ORDER BY t."aprovadoEm"`, [empresaId, filtro.caixaId ?? null, filtro.inicio ?? null, filtro.fim ?? null]);
  const total = (metodos: string[]) => pagamentos.filter(p => metodos.includes(p.metodo)).reduce((s, p) => s + p.valorCentavos, 0) / 100;
  return { totalPix: total(["PIX"]), totalCartao: total(["CARTAO_CREDITO", "CARTAO_DEBITO"]), totalOutros: total(["OUTRO"]), totalRecebido: pagamentos.reduce((s, p) => s + p.valorCentavos, 0) / 100, pagamentos };
}

export async function mesaComDivisaoPendente(mesaId: string) {
  if (!await estruturaPronta()) return false;
  const rows = await db.query(`SELECT c.id FROM "ContaDividida" c JOIN "Pedido" p ON p.id=c."pedidoId" WHERE p."mesaId"=$1 AND c.status NOT IN ('QUITADA','CANCELADA') LIMIT 1`, [mesaId]);
  return rows.length > 0;
}
