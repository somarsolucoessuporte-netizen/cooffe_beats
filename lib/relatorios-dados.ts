import { prisma } from "@/lib/prisma";
import { resumoCaixa } from "@/lib/caixa-fechamento";
import { dataHora, duracao } from "@/lib/chamados-tempo";

export type Secao = { id: string; nome: string; colunas: string[]; linhas: (string | number | null)[][] };

export const SECOES = [
  { id: "vendas-dia", nome: "Vendas por dia" },
  { id: "metodos", nome: "Por método de pagamento" },
  { id: "pedidos", nome: "Pedidos" },
  { id: "produtos", nome: "Produtos mais vendidos" },
  { id: "reservas", nome: "Reservas de mesa" },
  { id: "clientes", nome: "Clientes cadastrados" },
  { id: "caixas", nome: "Fechamentos de caixa" },
  { id: "chamados", nome: "Chamados de suporte" },
] as const;

const LIMITE = 20000;
const r2 = (n: unknown) => Math.round(Number(n ?? 0) * 100) / 100;

/** Período em dias civis de America/Sao_Paulo (sem horário de verão): devolve UTC em texto para comparar com timestamp do banco. */
export function periodoUtc(inicio: string, fim: string) {
  const a = new Date(`${inicio}T00:00:00-03:00`);
  const b = new Date(`${fim}T23:59:59.999-03:00`);
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || a > b) throw new Error("Período inválido");
  if (b.getTime() - a.getTime() > 400 * 86400000) throw new Error("Período máximo: 400 dias");
  return { ini: a.toISOString().slice(0, 23).replace("T", " "), fim: b.toISOString().slice(0, 23).replace("T", " ") };
}

const q = <T,>(sql: string, p: unknown[]) => prisma.$queryRawUnsafe<T[]>(sql, ...p);

export async function montarRelatorio(empresaId: string, inicio: string, fim: string, somar: boolean, ids?: string[]): Promise<Secao[]> {
  const { ini, fim: fimUtc } = periodoUtc(inicio, fim);
  const quer = (id: string) => !ids || ids.includes(id);
  const secoes: Secao[] = [];
  const periodo = [empresaId, ini, fimUtc];
  const SP = `AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'`;

  // Vendas: só pedidos concluídos e só pagamentos APROVADOS (mesma regra do fechamento de caixa)
  let porDia: Record<string, unknown>[] = [];
  if (quer("vendas-dia") || quer("metodos")) {
    porDia = await q<Record<string, unknown>>(`
      SELECT to_char(p."criadoEm" ${SP}, 'YYYY-MM-DD') AS dia, COUNT(*)::int AS pedidos, COALESCE(SUM(p.total),0)::float8 AS vendas,
        COALESCE(SUM(p.total) FILTER (WHERE pg.status='APROVADO' AND pg.metodo='DINHEIRO'),0)::float8 AS dinheiro,
        COALESCE(SUM(p.total) FILTER (WHERE pg.status='APROVADO' AND pg.metodo='CARTAO_CREDITO'),0)::float8 AS credito,
        COALESCE(SUM(p.total) FILTER (WHERE pg.status='APROVADO' AND pg.metodo='CARTAO_DEBITO'),0)::float8 AS debito,
        COALESCE(SUM(p.total) FILTER (WHERE pg.status='APROVADO' AND pg.metodo='CARTAO_PREPAGO'),0)::float8 AS prepago,
        COUNT(*) FILTER (WHERE pg.status='APROVADO' AND pg.payload->>'conciliacao'='manual_sem_conciliacao')::int AS "qtdSemConc",
        COALESCE(SUM(p.total) FILTER (WHERE pg.status='APROVADO' AND pg.payload->>'conciliacao'='manual_sem_conciliacao'),0)::float8 AS "semConc",
        COALESCE(SUM(p.total) FILTER (WHERE pg.status='APROVADO' AND pg.metodo='PIX' AND COALESCE(pg.payload->>'origem','')<>'PIX_CNPJ_ESTATICO'),0)::float8 AS "pixQr",
        COALESCE(SUM(p.total) FILTER (WHERE pg.status='APROVADO' AND pg.metodo='PIX' AND pg.payload->>'origem'='PIX_CNPJ_ESTATICO'),0)::float8 AS "pixCnpj",
        COALESCE(SUM(d.v),0)::float8 AS dividida
      FROM "Pedido" p LEFT JOIN "Pagamento" pg ON pg."pedidoId"=p.id
      LEFT JOIN (SELECT c."pedidoId", SUM(t.valor)/100.0 AS v FROM "ContaDividida" c JOIN "TentativaParcela" t ON t."contaId"=c.id AND t.status='APROVADO' GROUP BY 1) d ON d."pedidoId"=p.id
      WHERE p."empresaId"=$1 AND p."criadoEm">=$2::timestamp AND p."criadoEm"<=$3::timestamp AND p.status NOT IN ('CANCELADO','AGUARDANDO_PAGAMENTO')
      GROUP BY 1 ORDER BY 1`, periodo);
  }
  const soma = (k: string) => r2(porDia.reduce((s, d) => s + Number(d[k] ?? 0), 0));
  if (quer("vendas-dia")) {
    secoes.push({ id: "vendas-dia", nome: "Vendas por dia", colunas: ["Dia", "Pedidos", "Total vendas", "Dinheiro", "Crédito", "Débito", "Pré-pago", "Pix QR", "Pix CNPJ (manual)", "Conta dividida", "Manual sem conciliação (qtd)", "Manual sem conciliação (valor)"],
      linhas: [...porDia.map(d => [String(d.dia).split("-").reverse().join("/"), Number(d.pedidos), r2(d.vendas), r2(d.dinheiro), r2(d.credito), r2(d.debito), r2(d.prepago), r2(d.pixQr), r2(d.pixCnpj), r2(d.dividida), Number(d.qtdSemConc), r2(d.semConc)]),
        ["TOTAL", porDia.reduce((s, d) => s + Number(d.pedidos), 0), soma("vendas"), soma("dinheiro"), soma("credito"), soma("debito"), soma("prepago"), soma("pixQr"), soma("pixCnpj"), soma("dividida"), soma("qtdSemConc"), soma("semConc")]] });
  }
  if (quer("metodos")) {
    secoes.push({ id: "metodos", nome: "Por método de pagamento", colunas: ["Método", "Total recebido"],
      linhas: [["Dinheiro", soma("dinheiro")], ["Cartão de crédito", soma("credito")], ["Cartão de débito", soma("debito")], ["Cartão pré-pago", soma("prepago")], ["Pix QR", soma("pixQr")], ["Pix CNPJ (manual)", soma("pixCnpj")], ["Conta dividida (todos os meios)", soma("dividida")], [`Manual sem conciliação (${soma("qtdSemConc")}), já incluído acima`, soma("semConc")]] });
  }

  if (quer("pedidos")) {
    const l = await q<Record<string, unknown>>(`
      SELECT p.senha, p."criadoEm" AS criado, p.origem::text AS origem, p."pagamentoAntecipado" AS adiantado, p.status::text AS status, p.subtotal::float8 AS subtotal,
        COALESCE(p."valorDesconto",0)::float8 AS desconto, p.total::float8 AS total, pg.metodo::text AS metodo, pg.status::text AS "statusPagamento", cv.nome AS canal, m.numero::text AS mesa, cl.nome AS cliente,
        (SELECT string_agg(i.quantidade || 'x ' || pr.nome, '; ' ORDER BY pr.nome) FROM "ItemPedido" i JOIN "Produto" pr ON pr.id=i."produtoId" WHERE i."pedidoId"=p.id) AS itens
      FROM "Pedido" p LEFT JOIN "Pagamento" pg ON pg."pedidoId"=p.id LEFT JOIN canais_venda cv ON cv.id=p."canalVendaId" LEFT JOIN mesas m ON m.id=p."mesaId" LEFT JOIN clientes cl ON cl.id=p."clienteId"
      WHERE p."empresaId"=$1 AND p."criadoEm">=$2::timestamp AND p."criadoEm"<=$3::timestamp ORDER BY p."criadoEm" LIMIT ${LIMITE}`, periodo);
    secoes.push({ id: "pedidos", nome: "Pedidos", colunas: ["Senha", "Data/hora", "Origem", "Status", "Itens", "Subtotal", "Desconto", "Total", "Pagamento", "Status pagamento", "Canal", "Mesa", "Cliente"],
      linhas: l.map(p => [String(p.senha), dataHora(p.criado as Date), `${p.origem}${p.adiantado ? " (pedido adiantado)" : ""}`, String(p.status), (p.itens as string) ?? "", r2(p.subtotal), r2(p.desconto), r2(p.total), (p.metodo as string) ?? "", (p.statusPagamento as string) ?? "", (p.canal as string) ?? "", (p.mesa as string) ?? "", (p.cliente as string) ?? ""]) });
  }

  if (quer("produtos")) {
    const l = await q<{ nome: string; quantidade: number; total: number }>(`
      SELECT pr.nome, SUM(i.quantidade)::int AS quantidade, SUM(i."precoTotal")::float8 AS total
      FROM "ItemPedido" i JOIN "Pedido" p ON p.id=i."pedidoId" JOIN "Produto" pr ON pr.id=i."produtoId"
      WHERE p."empresaId"=$1 AND p."criadoEm">=$2::timestamp AND p."criadoEm"<=$3::timestamp AND p.status NOT IN ('CANCELADO','AGUARDANDO_PAGAMENTO')
      GROUP BY pr.nome ORDER BY 2 DESC, 3 DESC LIMIT 500`, periodo);
    secoes.push({ id: "produtos", nome: "Produtos mais vendidos", colunas: ["Produto", "Quantidade", "Total"], linhas: l.map(p => [p.nome, p.quantidade, r2(p.total)]) });
  }

  if (quer("reservas")) {
    const l = await q<Record<string, unknown>>(`
      SELECT a."nomeCliente", a.telefone, a.data, a.pessoas, a.duracao, a.status, a.observacao, m.numero::text AS mesa
      FROM agendamentos a LEFT JOIN mesas m ON m.id=a."mesaId"
      WHERE a."empresaId"=$1 AND a.data>=$2::timestamp AND a.data<=$3::timestamp ORDER BY a.data LIMIT ${LIMITE}`, periodo);
    secoes.push({ id: "reservas", nome: "Reservas de mesa", colunas: ["Cliente", "Telefone", "Data/hora", "Pessoas", "Duração (min)", "Status", "Mesa", "Observação"],
      linhas: l.map(a => [String(a.nomeCliente), String(a.telefone), dataHora(a.data as Date), Number(a.pessoas), Number(a.duracao), String(a.status), (a.mesa as string) ?? "", (a.observacao as string) ?? ""]) });
  }

  if (quer("clientes")) {
    const l = await q<Record<string, unknown>>(`
      SELECT nome, whatsapp, "totalVisitas", "totalGasto"::float8 AS gasto, "ultimaVisita", "criadoEm" FROM clientes
      WHERE "empresaId"=$1 AND "criadoEm">=$2::timestamp AND "criadoEm"<=$3::timestamp ORDER BY "criadoEm" LIMIT ${LIMITE}`, periodo);
    secoes.push({ id: "clientes", nome: "Clientes cadastrados", colunas: ["Nome", "WhatsApp", "Visitas", "Total gasto", "Última visita", "Cadastrado em"],
      linhas: l.map(c => [String(c.nome), (c.whatsapp as string) ?? "", Number(c.totalVisitas), r2(c.gasto), dataHora(c.ultimaVisita as Date), dataHora(c.criadoEm as Date)]) });
  }

  if (quer("caixas")) {
    const caixas = await q<{ id: string; abertura: Date; fechamento: Date | null; operador: string | null; status: string; valorAbertura: number; valorFechamento: number | null; observacao: string | null }>(`
      SELECT c.id, c."abridoEm" AS abertura, c."fechadoEm" AS fechamento, COALESCE(u.nome, c."operadorNome") AS operador, c.status::text AS status,
        c."valorAbertura"::float8 AS "valorAbertura", c."valorFechamento"::float8 AS "valorFechamento", c.observacao
      FROM caixas c LEFT JOIN "Usuario" u ON u.id=c."usuarioId"
      WHERE c."empresaId"=$1 AND c."abridoEm">=$2::timestamp AND c."abridoEm"<=$3::timestamp ORDER BY c."abridoEm" LIMIT 120`, periodo);
    const linhas: Secao["linhas"] = [];
    for (const c of caixas) {
      const t = await resumoCaixa(empresaId, c.id).catch(() => null);
      linhas.push([dataHora(c.abertura), c.fechamento ? dataHora(c.fechamento) : "—", c.status, c.operador ?? "", r2(c.valorAbertura), c.valorFechamento == null ? "" : r2(c.valorFechamento),
        t?.totalPedidos ?? "", t?.totalVendas ?? "", t?.totalDinheiro ?? "", t?.totalCredito ?? "", t?.totalDebito ?? "", t?.totalPrepago ?? "", t?.totalPixQr ?? "", t?.totalPixCnpj ?? "", t?.qtdSemConciliacao ?? "", t?.totalSemConciliacao ?? "", c.observacao ?? ""]);
    }
    secoes.push({ id: "caixas", nome: "Fechamentos de caixa", colunas: ["Abertura", "Fechamento", "Status", "Operador", "Troco inicial", "Valor fechamento", "Pedidos", "Total vendas", "Dinheiro", "Crédito", "Débito", "Pré-pago", "Pix QR", "Pix CNPJ (manual)", "Manual sem conciliação (qtd)", "Manual sem conciliação (valor)", "Observações / pendências"], linhas });
  }

  if (quer("chamados")) {
    const l = await q<Record<string, unknown>>(`
      SELECT c.numero, c."abertoEm", c.motivo, c.prioridade, c.status, c.titulo, c."usuarioNome", c."primeiraRespostaEm", c."resolvidoEm", c."fechadoEm", c.reaberturas
      FROM "Chamado" c WHERE ($4::boolean OR c."empresaId"=$1) AND c."abertoEm">=$2::timestamp AND c."abertoEm"<=$3::timestamp ORDER BY c."abertoEm" LIMIT ${LIMITE}`, [...periodo, somar]);
    const dur = (a: unknown, b: unknown) => (a && b ? duracao(new Date(b as Date).getTime() - new Date(a as Date).getTime()) : "");
    secoes.push({ id: "chamados", nome: "Chamados de suporte", colunas: ["Nº", "Aberto em", "Motivo", "Prioridade", "Status", "Título", "Aberto por", "Tempo até 1ª resposta", "Tempo de solução", "Fechado em", "Reaberturas"],
      linhas: l.map(c => ["#" + String(c.numero).padStart(4, "0"), dataHora(c.abertoEm as Date), String(c.motivo), String(c.prioridade), String(c.status), String(c.titulo), String(c.usuarioNome),
        dur(c.abertoEm, c.primeiraRespostaEm), dur(c.abertoEm, c.resolvidoEm), c.fechadoEm ? dataHora(c.fechadoEm as Date) : "", Number(c.reaberturas)]) });
  }
  return secoes;
}
