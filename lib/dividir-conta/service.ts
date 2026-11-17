import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { ATIVOS, centavos, DivisaoError, ehPixQr, PIX_QR, validarParcelas } from "./domain";
import type { Conta, Database, Parcela, Provedor, Resultado, Sql, Tentativa } from "./domain";

export type ItemDivisao = { produtoId: string; quantidade: number; preco: number; observacao?: string; adicionais?: { adicionalId: string; preco: number }[] };
export type NovaConta = { empresaId: string; token: string; valores: number[]; itens: ItemDivisao[]; total: number; subtotal: number; cupomId?: string | null; desconto?: number; clienteId?: string; mesaId?: string; requestHash?: string };
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
function exigirToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new DivisaoError("Acesso inválido", 401);
}
export async function lock(tx: Sql) { await tx.query(`SELECT id FROM "DivisaoControle" WHERE id = 1 FOR UPDATE`); }

async function bloqueioCobranca(sql: Sql, deviceId?: string) {
  // Só bloqueia o que está realmente em andamento: tentativa ativa da Point, operação integral
  // iniciada há menos de 3 min e Pagamento Point pendente há menos de 6 min. Pendências mais
  // antigas (timeout, cancelamento que falhou) não prendem mais a tela — as tentativas de parcela
  // vencidas são encerradas por expirarPendentes (consulta, cancela no MP e libera).
  // Pix QR não usa a Point: tentativas "PIX_QR:*" nunca bloqueiam a maquininha.
  const [bloqueio] = await sql.query<{ motivo: string }>(`
    SELECT 'PARCELA_EM_ANDAMENTO' AS motivo FROM "TentativaParcela"
      WHERE status IN ('CRIANDO','PENDENTE','DESCONHECIDO')
        AND ($1::text IS NULL OR "deviceId"=$1)
    UNION ALL SELECT 'OPERACAO_INDETERMINADA' AS motivo FROM "DivisaoOperacaoLegada"
      WHERE "criadoEm" > CURRENT_TIMESTAMP - INTERVAL '3 minutes'
    UNION ALL SELECT 'POINT_INTEGRAL_PENDENTE' AS motivo FROM "Pagamento"
      WHERE status='PENDENTE'
        AND "criadoEm" > CURRENT_TIMESTAMP - INTERVAL '6 minutes'
        AND (payload ? 'paymentIntentId' OR payload ? 'deviceId')
        AND payload->>'checkoutPro' IS DISTINCT FROM 'true'
        AND ($1::text IS NULL OR NULLIF(payload->>'deviceId','') IS NULL OR payload->>'deviceId'=$1)
    LIMIT 1`, [deviceId ?? null]);
  return bloqueio?.motivo ?? null;
}

export function criarServico(db: Database, provider: Provedor, enabled: () => boolean, deviceAtual: () => string | undefined = () => undefined) {
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
    return { id, pedidoId: c.pedidoId, senha: pedido.senha, total: c.total, pago, reservado, saldo: c.total - pago, status: c.status, habilitada: enabled(), bloqueioCobranca: await bloqueioCobranca(db, deviceAtual()),
      pix: tentativas.filter(t => ehPixQr(t.deviceId) && ATIVOS.includes(t.status as typeof ATIVOS[number]) && t.qrData).map(t => ({ tentativaId: t.id, parcelaId: t.parcelaId, qrData: t.qrData as string, valor: t.valor })),
      parcelas: parcelas.map(p => ({ ...p, tentativas: tentativas.filter(t => t.parcelaId === p.id).map(t => ({ id: t.id, status: t.status, meio: ehPixQr(t.deviceId) ? "PIX" : "POINT" })) })) };
  }

  async function cobrar(id: string, token: string, parcelaId: string, chave: string, deviceId: string) {
    // Existing attempts can always be consulted; new attempts require the flag.
    if (!enabled()) throw new DivisaoError("Novas cobranças estão desativadas", 403);
    if (!/^[a-f0-9-]{36}$/.test(chave) || !deviceId) throw new DivisaoError("Tentativa inválida", 400);
    // Pendências vencidas (timeout da maquineta, cancelamento que falhou) são liberadas antes de reservar.
    await expirarPendentes(id).catch(() => {});
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
      if (await bloqueioCobranca(tx, deviceId)) throw new DivisaoError("Há pagamento em andamento. Aguarde a confirmação antes de usar a maquininha");
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

  /**
   * Parcela por Pix QR na tela. O valor vem SEMPRE da parcela gravada (nunca do front) e a
   * Point não é usada: o deviceId é "PIX_QR:<tentativa>" e o intentId guarda a order do MP.
   */
  async function cobrarPix(id: string, token: string, parcelaId: string, chave: string) {
    if (!enabled()) throw new DivisaoError("Novas cobranças estão desativadas", 403);
    if (!/^[a-f0-9-]{36}$/.test(chave)) throw new DivisaoError("Tentativa inválida", 400);
    await expirarPendentes(id).catch(() => {});
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
      const [saldo] = await tx.query<{ usado: number }>(`SELECT COALESCE(SUM(valor),0)::integer AS usado FROM "TentativaParcela" WHERE "contaId" = $1 AND status IN ('CRIANDO','PENDENTE','DESCONHECIDO','APROVADO','REVISAO')`, [id]);
      if (saldo.usado + parte.valor > conta.total) throw new DivisaoError("Saldo insuficiente");
      const tentativaId = randomUUID();
      const [tentativa] = await tx.query<Tentativa>(`INSERT INTO "TentativaParcela" (id,"contaId","parcelaId",chave,referencia,"deviceId",valor,status) VALUES ($1,$2,$3,$4,$5,$6,$7,'CRIANDO') RETURNING *`, [tentativaId, id, parcelaId, chave, `DC-${tentativaId}`, `${PIX_QR}${tentativaId}`, parte.valor]);
      return { tentativa, nova: true };
    });
    if (reserva.nova) {
      try {
        const { orderId, qrData } = await provider.criarPix({ referencia: reserva.tentativa.referencia, valorCentavos: reserva.tentativa.valor });
        await db.query(`UPDATE "TentativaParcela" SET "intentId" = COALESCE("intentId",$2), "qrData" = $3, status = CASE WHEN status = 'CRIANDO' THEN 'PENDENTE' ELSE status END WHERE id = $1 RETURNING id`, [reserva.tentativa.id, orderId, qrData]);
      } catch (e) {
        // Não gerou QR (MP recusou/fora do ar): nada foi cobrado, a parcela volta a ficar disponível.
        console.error("[Divisão Pix] QR não gerado", e instanceof Error ? e.message : e);
        await db.query(`UPDATE "TentativaParcela" SET status = 'RECUSADO' WHERE id = $1 AND status IN ('CRIANDO','PENDENTE') RETURNING id`, [reserva.tentativa.id]);
        throw new DivisaoError("Não foi possível gerar o QR Pix. Tente novamente.", 502);
      }
    }
    return resumo(id, token);
  }

  /**
   * Pix estático (chave CNPJ) da parcela: o QR não avisa o sistema, então o atendente confirma que o
   * dinheiro caiu. Registra uma tentativa APROVADA ("PIX_CNPJ_MANUAL") com o valor da parcela gravado
   * no banco, para conferência no fim do dia. Cancela antes qualquer cobrança pendente da parcela.
   */
  async function confirmarPixManual(id: string, token: string, parcelaId: string, chave: string) {
    if (!/^[a-f0-9-]{36}$/.test(chave)) throw new DivisaoError("Tentativa inválida", 400);
    await autorizar(db, id, token);
    const pendentes = await db.query<Tentativa>(`SELECT * FROM "TentativaParcela" WHERE "contaId"=$1 AND "parcelaId"=$2 AND status IN ('CRIANDO','PENDENTE','DESCONHECIDO')`, [id, parcelaId]);
    for (const p of pendentes) {
      const r = await encerrarTentativa(p);
      if (r === "mantida") throw new DivisaoError("Há uma cobrança pendente nesta parcela que não pôde ser cancelada agora. Tente novamente.");
    }
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
      if (ativa) throw new DivisaoError("Parcela com pagamento em andamento");
      const [saldo] = await tx.query<{ usado: number }>(`SELECT COALESCE(SUM(valor),0)::integer AS usado FROM "TentativaParcela" WHERE "contaId" = $1 AND status IN ('CRIANDO','PENDENTE','DESCONHECIDO','APROVADO','REVISAO')`, [id]);
      if (saldo.usado + parte.valor > conta.total) throw new DivisaoError("Saldo insuficiente");
      const tentativaId = randomUUID();
      const [tentativa] = await tx.query<Tentativa>(`INSERT INTO "TentativaParcela" (id,"contaId","parcelaId",chave,referencia,"deviceId",valor,status) VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDENTE') RETURNING *`, [tentativaId, id, parcelaId, chave, `DC-${tentativaId}`, `PIX_MANUAL:${tentativaId}`, parte.valor]);
      return { tentativa, nova: true };
    });
    if (reserva.nova) {
      const t = reserva.tentativa;
      await receber({ referencia: t.referencia, status: "PAID", paymentId: `manual-${t.id}`, valorCentavos: t.valor, moeda: "BRL", metodo: "PIX_CNPJ_MANUAL" }, `manual:${t.id}`);
    }
    return resumo(id, token);
  }

  /**
   * Encerra uma tentativa ativa: confere o resultado, cancela no Mercado Pago (Point ou order QR)
   * e só então libera. Se pagou nesse meio tempo, registra o pagamento. Nunca lança.
   * "mantida" = não foi possível cancelar agora; a reserva continua (nunca libera cobrança possivelmente paga).
   */
  async function encerrarTentativa(t: Tentativa): Promise<"paga" | "liberada" | "mantida"> {
    try {
      const antes = await provider.consultar({ referencia: t.referencia, intentId: t.intentId, deviceId: t.deviceId });
      if (antes && antes.status !== "PENDING") { await receber(antes, `encerrar:${hashToken(JSON.stringify(antes))}`); return antes.status === "FAILED" ? "liberada" : "paga"; }
      const cancelada = t.intentId ? await provider.cancelar({ intentId: t.intentId, deviceId: t.deviceId }) : false;
      const idadeMin = t.criadoEm ? (Date.now() - new Date(t.criadoEm).getTime()) / 60000 : 0;
      // Sem intentId a criação ficou indeterminada: só libera depois de 16 min sem nenhum pagamento localizado
      if (!cancelada && !(!t.intentId && idadeMin > 16)) return "mantida";
      const depois = await provider.consultar({ referencia: t.referencia, intentId: t.intentId, deviceId: t.deviceId });
      if (depois && (depois.status === "PAID" || depois.status === "REVIEW")) { await receber(depois, `encerrar:${hashToken(JSON.stringify(depois))}`); return "paga"; }
      await receber({ referencia: t.referencia, intentId: t.intentId ?? undefined, status: "FAILED" }, `encerrar:cancelada:${t.id}`);
      return "liberada";
    } catch (e) {
      console.warn("[Divisão] não encerrou tentativa", t.id, e instanceof Error ? e.message : e);
      return "mantida";
    }
  }

  /** Libera tentativas vencidas (Point > 8 min, Pix QR > 16 min). Chamado a cada consulta da conta. */
  async function expirarPendentes(contaId?: string) {
    const velhas = await db.query<Tentativa>(`SELECT * FROM "TentativaParcela"
      WHERE ($1::text IS NULL OR "contaId"=$1) AND status IN ('CRIANDO','PENDENTE','DESCONHECIDO')
        AND "criadoEm" < CURRENT_TIMESTAMP - (CASE WHEN "deviceId" LIKE 'PIX_QR:%' THEN INTERVAL '16 minutes' ELSE INTERVAL '8 minutes' END)
      LIMIT 10`, [contaId ?? null]);
    for (const t of velhas) await encerrarTentativa(t);
    return velhas.length;
  }

  /** "Cancelar esse pagamento": cancela as tentativas ativas da conta no MP e libera as parcelas. */
  async function cancelarPagamento(id: string, token: string) {
    await autorizar(db, id, token);
    const ativas = await db.query<Tentativa>(`SELECT * FROM "TentativaParcela" WHERE "contaId"=$1 AND status IN ('CRIANDO','PENDENTE','DESCONHECIDO')`, [id]);
    const resultados = await Promise.all(ativas.map(encerrarTentativa));
    const naoCancelados = resultados.filter(r => r === "mantida").length;
    return { ...(await resumo(id, token)), naoCancelados };
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
    await expirarPendentes(id).catch(() => {});
    // Durable throttle, also shared between serverless instances.
    const pendentes = await db.query<Tentativa>(`UPDATE "TentativaParcela" SET "consultadoEm"=CURRENT_TIMESTAMP WHERE "contaId"=$1 AND status IN ('CRIANDO','PENDENTE','DESCONHECIDO') AND ("consultadoEm" IS NULL OR "consultadoEm" < CURRENT_TIMESTAMP - INTERVAL '6 seconds') RETURNING *`, [id]);
    for (const t of pendentes) {
      try {
        const r = await provider.consultar({ referencia: t.referencia, intentId: t.intentId, deviceId: t.deviceId });
        if (r) await receber(r, `consulta:${hashToken(JSON.stringify(r))}`);
      } catch { /* Keep reservation; no speculative retry of a charge. */ }
    }
    return resumo(id, token);
  }

  async function recuperarEventos(contaId?: string) {
    const eventos = await db.query<{ id: string }>(`SELECT e.id FROM "EventoParcela" e JOIN "TentativaParcela" t ON t.id=e."tentativaId" WHERE NOT e.processado AND ($1::text IS NULL OR t."contaId"=$1) ORDER BY e."criadoEm" LIMIT 30`, [contaId ?? null]);
    for (const e of eventos) await processar(e.id);
    return eventos.length;
  }

  async function recuperarTudo() {
    const eventosRevistos = await recuperarEventos();
    const contas = await db.query<Conta>(`SELECT c.* FROM "ContaDividida" c WHERE c.status='ABERTA' AND EXISTS (SELECT 1 FROM "TentativaParcela" t WHERE t."contaId"=c.id AND t.status IN ('CRIANDO','PENDENTE','DESCONHECIDO')) ORDER BY (SELECT MIN(t."consultadoEm") FROM "TentativaParcela" t WHERE t."contaId"=c.id AND t.status IN ('CRIANDO','PENDENTE','DESCONHECIDO')) ASC NULLS FIRST, c."criadoEm" LIMIT 2`);
    let tentativasConsultadas = 0;
    let resultadosIdentificados = 0;
    let aindaIndeterminadas = 0;
    let falhasConsulta = 0;
    // Internal recovery does not require the public capability; query the provider directly.
    for (const c of contas) {
      await expirarPendentes(c.id).catch(() => {});
      // This conditional UPDATE is the durable claim: concurrent cron invocations
      // can select the same account, but only one can claim each attempt per 6s.
      const tentativas = await db.query<Tentativa>(`UPDATE "TentativaParcela" SET "consultadoEm"=CURRENT_TIMESTAMP WHERE "contaId"=$1 AND status IN ('CRIANDO','PENDENTE','DESCONHECIDO') AND ("consultadoEm" IS NULL OR "consultadoEm" < CURRENT_TIMESTAMP - INTERVAL '6 seconds') RETURNING *`, [c.id]);
      for (const t of tentativas) {
        tentativasConsultadas++;
        try {
          const r = await provider.consultar({ referencia: t.referencia, intentId: t.intentId, deviceId: t.deviceId });
          if (r) {
            await receber(r, `recuperacao:${hashToken(JSON.stringify(r))}`);
            if (r.status === "PENDING") aindaIndeterminadas++;
            else resultadosIdentificados++;
          } else {
            // Missing provider data is not proof of failure: retain the balance
            // reservation and wait for another query or a delayed webhook.
            aindaIndeterminadas++;
          }
        } catch (error) {
          // Never release the reservation or retry a charge on an API timeout.
          falhasConsulta++;
          console.warn("[Divisão recovery] consulta inconclusiva; reserva mantida", {
            tentativaId: t.id,
            erro: error instanceof Error ? error.name : "Erro desconhecido",
          });
        }
      }
    }
    return { eventosRevistos, tentativasConsultadas, resultadosIdentificados, aindaIndeterminadas, falhasConsulta };
  }
  /**
   * "Cancelar divisão e voltar": funciona em qualquer estado. Cancela no MP as tentativas
   * pendentes (Point e order QR); se nada foi pago, cancela a conta e o pedido. Se já há parcela paga,
   * a conta continua aberta (o dinheiro recebido é preservado) e devolve o saldo restante.
   */
  async function cancelar(id: string, token: string) {
    await autorizar(db, id, token);
    const ativas = await db.query<Tentativa>(`SELECT * FROM "TentativaParcela" WHERE "contaId"=$1 AND status IN ('CRIANDO','PENDENTE','DESCONHECIDO')`, [id]);
    await Promise.all(ativas.map(encerrarTentativa));
    return db.transaction(async tx => {
      await lock(tx);
      const c = await autorizar(tx, id, token);
      if (c.status === "CANCELADA") return { cancelada: true, pago: 0, saldo: c.total, pendentes: 0 };
      const [x] = await tx.query<{ pago: number; pendentes: number }>(`SELECT COALESCE(SUM(valor) FILTER (WHERE status='APROVADO'),0)::integer AS pago, COUNT(*) FILTER (WHERE status IN ('CRIANDO','PENDENTE','DESCONHECIDO','REVISAO'))::integer AS pendentes FROM "TentativaParcela" WHERE "contaId"=$1`, [id]);
      if (c.status === "ABERTA" && x.pago === 0 && x.pendentes === 0) {
        await tx.query(`UPDATE "ContaDividida" SET status='CANCELADA' WHERE id=$1 RETURNING id`, [id]);
        await tx.query(`UPDATE "Pedido" SET status='CANCELADO',"atualizadoEm"=CURRENT_TIMESTAMP WHERE id=$1 AND status='AGUARDANDO_PAGAMENTO' RETURNING id`, [c.pedidoId]);
        return { cancelada: true, pago: 0, saldo: c.total, pendentes: 0 };
      }
      return { cancelada: false, pago: x.pago, saldo: c.total - x.pago, pendentes: x.pendentes };
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
  return { criar, resumo, cobrar, cobrarPix, confirmarPixManual, cancelarPagamento, receber, reconciliar, recuperarTudo, cancelar, retomar, expirarPendentes };
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
