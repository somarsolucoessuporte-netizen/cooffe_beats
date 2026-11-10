import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { ATIVOS, centavos, DivisaoError, validarParcelas } from "./domain";
import type { Conta, Database, Parcela, Provedor, Resultado, Sql, Tentativa } from "./domain";

export type ItemDivisao = { produtoId: string; quantidade: number; preco: number; observacao?: string; adicionais?: { adicionalId: string; preco: number }[] };
export type NovaConta = { empresaId: string; token: string; valores: number[]; itens: ItemDivisao[]; total: number; subtotal: number; cupomId?: string | null; desconto?: number; clienteId?: string; mesaId?: string; requestHash?: string };
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
function exigirToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new DivisaoError("Acesso inválido", 401);
}
export async function lock(tx: Sql) { await tx.query(`SELECT id FROM "DivisaoControle" WHERE id = 1 FOR UPDATE`); }

export function criarServico(db: Database, provider: Provedor, enabled: () => boolean) {
  async function autorizar(tx: Sql, id: string, token: string): Promise<Conta> {
    exigirToken(token);
    const [conta] = await tx.query<Conta>(`SELECT * FROM "ContaDividida" WHERE id = $1`, [id]);
    const esperado = Buffer.from(conta?.tokenHash ?? "0".repeat(64));
    if (!timingSafeEqual(esperado, Buffer.from(hashToken(token)))) throw new DivisaoError("Conta não encontrada", 404);
    return conta;
  }

  async function criar(input: NovaConta) {
    if (!enabled()) throw new DivisaoError("Divisão de conta desativada", 403);
    exigirToken(input.token);
    const fingerprint = hashToken(JSON.stringify({ ...input, token: undefined }));
    return db.transaction(async tx => {
      await lock(tx);
      const [anterior] = await tx.query<Conta>(`SELECT * FROM "ContaDividida" WHERE "criacaoHash" = $1 OR "tokenHash" = $1`, [hashToken(input.token)]);
      if (anterior) {
        if (anterior.tokenHash !== hashToken(input.token)) throw new DivisaoError("Sessão transferida pelo atendente",401);
        if (input.requestHash ? anterior.requestHash !== input.requestHash : anterior.fingerprint !== fingerprint) throw new DivisaoError("Chave reutilizada com dados diferentes");
        return anterior.id;
      }
      const total = centavos(input.total);
      validarParcelas(total, input.valores);
      const [config] = await tx.query<{ senhaAtual: number; prefixoSenha: string }>(`UPDATE configuracoes SET "senhaAtual" = "senhaAtual" + 1 WHERE "empresaId" = $1 RETURNING "senhaAtual", "prefixoSenha"`, [input.empresaId]);
      if (!config) throw new DivisaoError("Empresa não configurada", 400);
      const [caixa] = await tx.query<{ id: string }>(`SELECT id FROM caixas WHERE "empresaId" = $1 AND status = 'ABERTO' ORDER BY "abridoEm" DESC LIMIT 1 FOR UPDATE`, [input.empresaId]);
      if (!caixa) throw new DivisaoError("Abra o caixa antes de dividir a conta");
      for (const [table, id] of [["mesas", input.mesaId], ["clientes", input.clienteId]] as const) {
        if (id) {
          // table comes only from the fixed tuple above, never from the request.
          const rows = await tx.query(`SELECT id FROM ${table} WHERE id = $1 AND "empresaId" = $2`, [id, input.empresaId]);
          if (!rows.length) throw new DivisaoError("Mesa ou cliente inválido", 400);
        }
      }
      const pedidoId = randomUUID();
      await tx.query(`INSERT INTO "Pedido" (id,"empresaId",senha,status,origem,subtotal,total,"caixaId","clienteId","mesaId","cupomId","valorDesconto","atualizadoEm")
        VALUES ($1,$2,$3,'AGUARDANDO_PAGAMENTO','TOTEM',$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP) RETURNING id`,
        [pedidoId, input.empresaId, `${config.prefixoSenha}-${config.senhaAtual}`, input.subtotal, input.total, caixa.id, input.clienteId ?? null, input.mesaId ?? null, input.cupomId ?? null, input.desconto ?? null]);
      for (const item of input.itens) {
        const itemId = randomUUID();
        await tx.query(`INSERT INTO "ItemPedido" (id,"pedidoId","produtoId",quantidade,"precoUnit","precoTotal",observacao) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [itemId, pedidoId, item.produtoId, item.quantidade, item.preco, item.preco * item.quantidade, item.observacao ?? null]);
        for (const adicional of item.adicionais ?? []) {
          await tx.query(`INSERT INTO "ItemAdicional" (id,"itemPedidoId","adicionalId",preco) VALUES ($1,$2,$3,$4) RETURNING id`, [randomUUID(), itemId, adicional.adicionalId, adicional.preco]);
        }
      }
      if (input.cupomId) await tx.query(`UPDATE cupons SET "usoAtual" = "usoAtual" + 1 WHERE id = $1 RETURNING id`, [input.cupomId]);
      const id = randomUUID();
      await tx.query(`INSERT INTO "ContaDividida" (id,"pedidoId","empresaId","tokenHash","criacaoHash",fingerprint,"requestHash",total) VALUES ($1,$2,$3,$4,$4,$5,$6,$7) RETURNING id`, [id, pedidoId, input.empresaId, hashToken(input.token), fingerprint, input.requestHash ?? fingerprint, total]);
      for (const [i, valor] of input.valores.entries()) await tx.query(`INSERT INTO "ParcelaConta" (id,"contaId",ordem,valor) VALUES ($1,$2,$3,$4) RETURNING id`, [randomUUID(), id, i + 1, valor]);
      return id;
    });
  }

  async function resumo(id: string, token: string) {
    const c = await autorizar(db, id, token);
    const parcelas = await db.query<Parcela>(`SELECT * FROM "ParcelaConta" WHERE "contaId" = $1 ORDER BY ordem`, [id]);
    const tentativas = await db.query<Tentativa>(`SELECT * FROM "TentativaParcela" WHERE "contaId" = $1 ORDER BY "criadoEm", id`, [id]);
    const pago = tentativas.filter(t => t.status === "APROVADO").reduce((s, t) => s + t.valor, 0);
    const reservado = tentativas.filter(t => ATIVOS.includes(t.status as typeof ATIVOS[number])).reduce((s, t) => s + t.valor, 0);
    const [pedido] = await db.query<{ senha: string }>(`SELECT senha FROM "Pedido" WHERE id = $1`, [c.pedidoId]);
    return { id, pedidoId: c.pedidoId, senha: pedido.senha, total: c.total, pago, reservado, saldo: c.total - pago, status: c.status, habilitada: enabled(), parcelas: parcelas.map(p => ({ ...p, tentativas: tentativas.filter(t => t.parcelaId === p.id).map(t => ({ id: t.id, status: t.status })) })) };
  }

  async function cobrar(id: string, token: string, parcelaId: string, chave: string, deviceId: string) {
    // Existing attempts can always be consulted; new attempts require the flag.
    if (!enabled()) throw new DivisaoError("Novas cobranças estão desativadas", 403);
    if (!/^[a-f0-9-]{36}$/.test(chave) || !deviceId) throw new DivisaoError("Tentativa inválida", 400);
    const reserva = await db.transaction(async tx => {
      await lock(tx);
      const conta = await autorizar(tx, id, token);
      const [existing] = await tx.query<Tentativa>(`SELECT * FROM "TentativaParcela" WHERE chave = $1`, [chave]);
      if (existing) {
        if (existing.contaId !== id || existing.parcelaId !== parcelaId) throw new DivisaoError("Chave de outra operação");
        return { tentativa: existing, nova: false };
      }
      if (conta.status !== "ABERTA") throw new DivisaoError("Conta quitada ou em revisão");
      const [parte] = await tx.query<Parcela>(`SELECT * FROM "ParcelaConta" WHERE id = $1 AND "contaId" = $2`, [parcelaId, id]);
      if (!parte || parte.status !== "ABERTA") throw new DivisaoError("Parcela indisponível");
      const [ativa] = await tx.query<Tentativa>(`SELECT * FROM "TentativaParcela" WHERE "parcelaId" = $1 AND status IN ('CRIANDO','PENDENTE','DESCONHECIDO','REVISAO')`, [parcelaId]);
      if (ativa) return { tentativa: ativa, nova: false };
      const ocupada = await tx.query(`SELECT id FROM "TentativaParcela" WHERE "deviceId" = $1 AND status IN ('CRIANDO','PENDENTE','DESCONHECIDO')`, [deviceId]);
      const legados = await tx.query(`SELECT id FROM "DivisaoOperacaoLegada" UNION ALL SELECT id FROM "Pagamento" WHERE status = 'PENDENTE' AND metodo NOT IN ('DINHEIRO','SIMULADO') LIMIT 1`);
      if (ocupada.length || legados.length) throw new DivisaoError("Há pagamento em andamento. Aguarde a confirmação antes de usar a maquininha");
      const [saldo] = await tx.query<{ usado: number }>(`SELECT COALESCE(SUM(valor),0)::integer AS usado FROM "TentativaParcela" WHERE "contaId" = $1 AND status IN ('CRIANDO','PENDENTE','DESCONHECIDO','APROVADO','REVISAO')`, [id]);
      if (saldo.usado + parte.valor > conta.total) throw new DivisaoError("Saldo insuficiente");
      const tentativaId = randomUUID();
      const [tentativa] = await tx.query<Tentativa>(`INSERT INTO "TentativaParcela" (id,"contaId","parcelaId",chave,referencia,"deviceId",valor,status) VALUES ($1,$2,$3,$4,$5,$6,$7,'CRIANDO') RETURNING *`, [tentativaId, id, parcelaId, chave, `DC-${tentativaId}`, deviceId, parte.valor]);
      return { tentativa, nova: true };
    });
    if (reserva.nova) {
      try {
        const result = await provider.criar({ referencia: reserva.tentativa.referencia, valorCentavos: reserva.tentativa.valor, deviceId });
        await db.query(`UPDATE "TentativaParcela" SET "intentId" = COALESCE("intentId",$2), status = CASE WHEN status = 'CRIANDO' THEN 'PENDENTE' ELSE status END WHERE id = $1 RETURNING id`, [reserva.tentativa.id, result.intentId]);
      } catch {
        // Never reissue automatically: the remote call may have succeeded.
        await db.query(`UPDATE "TentativaParcela" SET status = 'DESCONHECIDO' WHERE id = $1 AND status IN ('CRIANDO','PENDENTE') RETURNING id`, [reserva.tentativa.id]);
      }
    }
    return resumo(id, token);
  }

  async function receber(resultado: Resultado, eventoId: string) {
    // Never gate reconciliation or webhooks on the creation feature flag.
    const [tentativa] = await db.query<Tentativa>(`SELECT * FROM "TentativaParcela" WHERE referencia = $1`, [resultado.referencia]);
    if (!tentativa) throw new DivisaoError("Tentativa de divisão não encontrada", 404);
    const eventKey = hashToken(`${tentativa.id}:${eventoId}`);
    await db.query(`INSERT INTO "EventoParcela" (id,"tentativaId",resultado) VALUES ($1,$2,$3::jsonb) ON CONFLICT (id) DO NOTHING RETURNING id`, [eventKey, tentativa.id, JSON.stringify(resultado)]);
    await processar(eventKey);
  }

  async function processar(eventKey: string) {
    await db.transaction(async tx => {
      await lock(tx);
      const [evento] = await tx.query<{ resultado: Resultado; processado: boolean; tentativaId: string }>(`SELECT * FROM "EventoParcela" WHERE id = $1 FOR UPDATE`, [eventKey]);
      if (!evento || evento.processado) return;
      const r = evento.resultado;
      const [t] = await tx.query<Tentativa>(`SELECT * FROM "TentativaParcela" WHERE id = $1`, [evento.tentativaId]);
      const [c] = await tx.query<Conta>(`SELECT * FROM "ContaDividida" WHERE id = $1`, [t.contaId]);
      let revisao = r.status === "REVIEW";
      if (r.status === "PAID") {
        const [outra] = r.paymentId ? await tx.query<Tentativa>(`SELECT * FROM "TentativaParcela" WHERE "paymentId" = $1 AND id <> $2`, [r.paymentId, t.id]) : [];
        const [parcelaPaga] = await tx.query<Tentativa>(`SELECT * FROM "TentativaParcela" WHERE "parcelaId" = $1 AND status = 'APROVADO' AND id <> $2`, [t.parcelaId, t.id]);
        revisao = !r.paymentId || r.valorCentavos !== t.valor || r.moeda !== "BRL" || !!outra || !!parcelaPaga || (!!t.paymentId && t.paymentId !== r.paymentId) || (!!r.intentId && !!t.intentId && r.intentId !== t.intentId);
        if (!revisao && t.status !== "REVISAO") {
          // A late approval is real money. If another attempt exists, freeze it too.
          const concorrentes = await tx.query<Tentativa>(`SELECT * FROM "TentativaParcela" WHERE "parcelaId" = $1 AND id <> $2 AND status IN ('CRIANDO','PENDENTE','DESCONHECIDO','REVISAO')`, [t.parcelaId, t.id]);
          if (concorrentes.length) revisao = true;
          else {
            await tx.query(`UPDATE "TentativaParcela" SET status='APROVADO', "paymentId"=$2, "intentId"=COALESCE("intentId",$3), metodo=$4, "aprovadoEm"=COALESCE("aprovadoEm",CURRENT_TIMESTAMP) WHERE id=$1 RETURNING id`, [t.id, r.paymentId, r.intentId ?? null, r.metodo ?? "OUTRO"]);
            await tx.query(`UPDATE "ParcelaConta" SET status='APROVADO' WHERE id=$1 RETURNING id`, [t.parcelaId]);
          }
        }
      } else if (r.status === "FAILED" && ATIVOS.includes(t.status as typeof ATIVOS[number])) {
        await tx.query(`UPDATE "TentativaParcela" SET status='RECUSADO' WHERE id=$1 RETURNING id`, [t.id]);
      }
      if (revisao) {
        await tx.query(`UPDATE "ContaDividida" SET status='REVISAO' WHERE id=$1 RETURNING id`, [c.id]);
        // Preserve previously confirmed receipts; the event contains the conflicting payment.
        if (t.status !== "APROVADO" || r.status === "REVIEW") {
          const estado = ATIVOS.includes(t.status as typeof ATIVOS[number]) ? "DESCONHECIDO" : "REVISAO";
          await tx.query(`UPDATE "TentativaParcela" SET status=$2 WHERE id=$1 RETURNING id`, [t.id, estado]);
        }
        await tx.query(`UPDATE "ParcelaConta" SET status='REVISAO' WHERE id=$1 RETURNING id`, [t.parcelaId]);
        await tx.query(`UPDATE "Pedido" SET pago=FALSE WHERE id=$1 RETURNING id`, [c.pedidoId]);
      }
      const [saldo] = await tx.query<{ pago: number; ativos: number }>(`SELECT COALESCE(SUM(valor) FILTER (WHERE status='APROVADO'),0)::integer AS pago, COUNT(*) FILTER (WHERE status IN ('CRIANDO','PENDENTE','DESCONHECIDO','REVISAO'))::integer AS ativos FROM "TentativaParcela" WHERE "contaId"=$1`, [c.id]);
      const [atual] = await tx.query<Conta>(`SELECT * FROM "ContaDividida" WHERE id=$1`, [c.id]);
      if (atual.status === "ABERTA" && saldo.pago === c.total && saldo.ativos === 0) {
        await tx.query(`UPDATE "ContaDividida" SET status='QUITADA' WHERE id=$1 RETURNING id`, [c.id]);
        await liberarConsumo(tx, c);
      }
      await tx.query(`UPDATE "EventoParcela" SET processado=TRUE WHERE id=$1 RETURNING id`, [eventKey]);
    });
  }

  async function reconciliar(id: string, token: string) {
    await autorizar(db, id, token);
    await recuperarEventos(id);
    // Durable throttle, also shared between serverless instances.
    const pendentes = await db.query<Tentativa>(`UPDATE "TentativaParcela" SET "consultadoEm"=CURRENT_TIMESTAMP WHERE "contaId"=$1 AND status IN ('CRIANDO','PENDENTE','DESCONHECIDO') AND ("consultadoEm" IS NULL OR "consultadoEm" < CURRENT_TIMESTAMP - INTERVAL '6 seconds') RETURNING *`, [id]);
    for (const t of pendentes) {
      try {
        const r = await provider.consultar({ referencia: t.referencia, intentId: t.intentId });
        if (r) await receber(r, `consulta:${hashToken(JSON.stringify(r))}`);
      } catch { /* Keep reservation; no speculative retry of a charge. */ }
    }
    return resumo(id, token);
  }

  async function recuperarEventos(contaId?: string) {
    const eventos = await db.query<{ id: string }>(`SELECT e.id FROM "EventoParcela" e JOIN "TentativaParcela" t ON t.id=e."tentativaId" WHERE NOT e.processado AND ($1::text IS NULL OR t."contaId"=$1) ORDER BY e."criadoEm" LIMIT 30`, [contaId ?? null]);
    for (const e of eventos) await processar(e.id);
  }

  async function recuperarTudo() {
    await recuperarEventos();
    const contas = await db.query<Conta>(`SELECT c.* FROM "ContaDividida" c WHERE c.status='ABERTA' AND EXISTS (SELECT 1 FROM "TentativaParcela" t WHERE t."contaId"=c.id AND t.status IN ('CRIANDO','PENDENTE','DESCONHECIDO')) ORDER BY (SELECT MIN(t."consultadoEm") FROM "TentativaParcela" t WHERE t."contaId"=c.id AND t.status IN ('CRIANDO','PENDENTE','DESCONHECIDO')) ASC NULLS FIRST, c."criadoEm" LIMIT 2`);
    // Internal recovery does not require the public capability; query the provider directly.
    for (const c of contas) {
      const tentativas = await db.query<Tentativa>(`UPDATE "TentativaParcela" SET "consultadoEm"=CURRENT_TIMESTAMP WHERE "contaId"=$1 AND status IN ('CRIANDO','PENDENTE','DESCONHECIDO') AND ("consultadoEm" IS NULL OR "consultadoEm" < CURRENT_TIMESTAMP - INTERVAL '6 seconds') RETURNING *`, [c.id]);
      for (const t of tentativas) {
        try {
          const r = await provider.consultar({ referencia: t.referencia, intentId: t.intentId });
          if (r) await receber(r, `recuperacao:${hashToken(JSON.stringify(r))}`);
        } catch { /* next scheduled/manual recovery */ }
      }
    }
  }
  async function cancelar(id: string, token: string) {
    await db.transaction(async tx => {
      await lock(tx);
      const c = await autorizar(tx,id,token);
      if (c.status === "CANCELADA") return;
      const tentativas = await tx.query(`SELECT id FROM "TentativaParcela" WHERE "contaId"=$1 LIMIT 1`,[id]);
      // Even a rejected external attempt can receive a late event. No speculative cancellation.
      if (c.status !== "ABERTA" || tentativas.length) throw new DivisaoError("Não é possível cancelar uma divisão que já iniciou cobrança");
      await tx.query(`UPDATE "ContaDividida" SET status='CANCELADA' WHERE id=$1 RETURNING id`,[id]);
      await tx.query(`UPDATE "Pedido" SET status='CANCELADO',"atualizadoEm"=CURRENT_TIMESTAMP WHERE id=$1 RETURNING id`,[c.pedidoId]);
    });
  }
  // Called exclusively behind staff authentication and company authorization.
  async function retomar(id: string, empresaId: string) {
    return db.transaction(async tx => {
      await lock(tx);
      const [c] = await tx.query<Conta>(`SELECT * FROM "ContaDividida" WHERE id=$1 AND "empresaId"=$2`,[id,empresaId]);
      if (!c || c.status === "CANCELADA") throw new DivisaoError("Conta não encontrada",404);
      const token = randomBytes(32).toString("hex");
      await tx.query(`UPDATE "ContaDividida" SET "tokenHash"=$2 WHERE id=$1 RETURNING id`,[id,hashToken(token)]);
      return {id,token};
    });
  }
  return { criar, resumo, cobrar, receber, reconciliar, recuperarTudo, cancelar, retomar };
}

// Runs only once, in the SAME transaction as settlement. No external effects here.
async function liberarConsumo(tx: Sql, c: Conta) {
  const [pedido] = await tx.query<{ clienteId: string | null; empresaId: string }>(`UPDATE "Pedido" SET pago=TRUE,status='RECEBIDO',"atualizadoEm"=CURRENT_TIMESTAMP WHERE id=$1 AND status='AGUARDANDO_PAGAMENTO' RETURNING "clienteId","empresaId"`, [c.pedidoId]);
  if (!pedido) throw new DivisaoError("Pedido precisa de revisão antes da quitação");
  if (pedido.clienteId) await tx.query(`UPDATE clientes SET "totalGasto"="totalGasto"+$2 WHERE id=$1 RETURNING id`, [pedido.clienteId, c.total / 100]);
  const consumos = await tx.query<{ insumoId: string; quantidade: string; custo: string }>(`SELECT f."insumoId", SUM(f.quantidade*i.quantidade)::text AS quantidade, MAX(s.custo)::text AS custo FROM "ItemPedido" i JOIN ficha_tecnica_itens f ON f."produtoId"=i."produtoId" JOIN insumos s ON s.id=f."insumoId" WHERE i."pedidoId"=$1 GROUP BY f."insumoId"`, [c.pedidoId]);
  for (const consumo of consumos) {
    await tx.query(`UPDATE insumos SET "estoqueAtual"=GREATEST(0,"estoqueAtual"-$2::numeric),"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1 RETURNING id`, [consumo.insumoId, consumo.quantidade]);
    await tx.query(`INSERT INTO movimentacoes_estoque (id,"empresaId","insumoId",tipo,quantidade,custo,origem,"pedidoId",observacao) VALUES ($1,$2,$3,'SAIDA',$4,$5,'VENDA',$6,'Quitação de conta dividida') RETURNING id`, [randomUUID(), pedido.empresaId, consumo.insumoId, consumo.quantidade, Number(consumo.quantidade) * Number(consumo.custo), c.pedidoId]);
  }
}
