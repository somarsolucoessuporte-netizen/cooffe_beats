import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { criarServico } from "../../lib/dividir-conta/service";
import { criarGuardas } from "../../lib/dividir-conta/legacy";
import { mercadoPagoDivisao, resultadoPayment } from "../../lib/dividir-conta/mercadopago";
import { criarPagamentoPoint } from "../../lib/mercadopago";
import { carregarRota, requisicao } from "./route-harness";
import { centavos, dividirIgualmente, validarParcelas } from "../../lib/dividir-conta/domain";
import type { Database, Provedor, Resultado, Sql, Tentativa } from "../../lib/dividir-conta/domain";

// No Prisma, .env, Supabase, Next server, sockets or real payment provider.
// SDK adapter tests use an intercepted fetch and a deliberately invalid test token.
// PostgreSQL runs as WebAssembly, in memory. The actual migration is tested here.
let pg: PGlite;
let db: Database;
let enabled = true;
let creates = 0;
let failCreate = false;
let consulta: Resultado | null = null;
const token = "a".repeat(64);
const provider: Provedor = {
  async criar() { creates++; if (failCreate) throw new Error("accepted remotely, response lost"); return { intentId: `intent-${creates}` }; },
  async consultar() { return consulta; },
};
let service: ReturnType<typeof criarServico>;
const originalFetch = globalThis.fetch;
const input = () => ({ empresaId: "empresa", token, valores: [334, 333, 333], total: 10, subtotal: 10, clienteId: "cliente", itens: [{ produtoId: "produto", quantidade: 1, preco: 10 }] });

before(async () => {
  pg = new PGlite();
  const query = async <T>(text: string, values: unknown[] = []) => (await pg.query(text, values)).rows as T[];
  db = { query, transaction: fn => pg.transaction(tx => fn({ query: async <T>(text: string, values: unknown[] = []) => (await tx.query(text, values)).rows as T[] })) };
  await pg.exec(await readFile("prisma/migrations/20260610202111_init/migration.sql", "utf8"));
  await pg.exec(await readFile("prisma/migrations/20260916120016_caixa_operador_anonimo/migration.sql", "utf8"));
  await pg.exec(await readFile("prisma/migrations/20260916120926_add_convite_usuario/migration.sql", "utf8"));
  await pg.exec(await readFile("prisma/migrations/20261021120000_checkout_sessao_mercadopago/migration.sql", "utf8"));
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated;`);
  // A manual editor's search_path must not redirect migration objects.
  await pg.exec(`SET search_path=pg_catalog`);
  await pg.exec(await readFile("prisma/migrations/20261110000000_dividir_conta/migration.sql", "utf8"));
  await pg.exec(`SET search_path=public`);
  globalThis.fetch = async () => { throw new Error("External network forbidden in isolated tests"); };
  process.env.MP_ACCESS_TOKEN = "TEST-ONLY-NOT-A-CREDENTIAL";
});
after(async () => { globalThis.fetch=originalFetch; delete process.env.MP_ACCESS_TOKEN; await pg?.close(); });
beforeEach(async () => {
  await pg.exec(`TRUNCATE "Empresa" CASCADE;
    INSERT INTO "Empresa" (id,nome,slug) VALUES ('empresa','Teste','teste');
    INSERT INTO configuracoes (id,"empresaId","prefixoSenha","senhaAtual") VALUES ('config','empresa','CB',100);
    INSERT INTO caixas (id,"empresaId",status,"valorAbertura") VALUES ('caixa','empresa','ABERTO',0);
    INSERT INTO clientes (id,"empresaId",nome,"totalGasto") VALUES ('cliente','empresa','Cliente',0);
    INSERT INTO "Categoria" (id,"empresaId",nome,emoji) VALUES ('cat','empresa','Teste','x');
    INSERT INTO "Produto" (id,"empresaId","categoriaId",nome,descricao,preco) VALUES ('produto','empresa','cat','Produto','Teste',10);
    INSERT INTO insumos (id,"empresaId",nome,unidade,"estoqueAtual","estoqueMinimo",custo,"updatedAt") VALUES ('insumo','empresa','Teste','un',10,0,2,CURRENT_TIMESTAMP);
    INSERT INTO ficha_tecnica_itens (id,"produtoId","insumoId",quantidade) VALUES ('ficha','produto','insumo',1);
    DELETE FROM "DivisaoOperacaoLegada";`);
  enabled = true; creates = 0; failCreate = false; consulta = null;
  service = criarServico(db, provider, () => enabled);
  globalThis.fetch = async () => { throw new Error("External network forbidden in isolated tests"); };
});

async function draft() {
  const id = await service.criar(input());
  return service.resumo(id, token);
}
async function charge(id: string, parcelaId: string, chave = randomUUID(), device = "point") {
  await service.cobrar(id, token, parcelaId, chave, device);
  return (await db.query<Tentativa>(`SELECT * FROM "TentativaParcela" WHERE "parcelaId"=$1 ORDER BY "criadoEm" DESC`, [parcelaId]))[0];
}
const paid = (t: Tentativa, paymentId = `payment-${t.id}`): Resultado => ({ referencia: t.referencia, status: "PAID", paymentId, intentId: t.intentId ?? undefined, valorCentavos: t.valor, moeda: "BRL", metodo: "PIX" });

test("centavos exatos, divisão igualitária e validação", () => {
  assert.equal(centavos("0,01"), 1);
  assert.equal(centavos("100.10"), 10010);
  assert.deepEqual(dividirIgualmente(1000, 3), [334,333,333]);
  for (let total = 2; total < 250; total++) for (let n = 2; n <= Math.min(20,total); n++) {
    const parts = dividirIgualmente(total, n); validarParcelas(total, parts);
    assert.ok(Math.max(...parts) - Math.min(...parts) <= 1);
  }
  assert.throws(() => centavos("1.001"));
  assert.throws(() => centavos("-2"));
  assert.throws(() => validarParcelas(100, [50,49]));
  assert.throws(() => validarParcelas(100, [100,0]));
});

test("flag desativada não cria pedido", async () => {
  enabled = false;
  await assert.rejects(service.criar(input()), /desativada/);
  assert.equal((await db.query(`SELECT id FROM "Pedido"`)).length, 0);
});

test("criação concorrente idempotente, sem duplicar consumo", async () => {
  const [a,b] = await Promise.all([service.criar(input()), service.criar(input())]);
  assert.equal(a,b);
  assert.equal((await db.query(`SELECT id FROM "Pedido"`)).length,1);
  await assert.rejects(service.criar({ ...input(), valores: [500,250,250] }), /dados diferentes/);
});

test("capability incorreta não consulta nem cobra", async () => {
  const c = await draft();
  await assert.rejects(service.resumo(c.id, "b".repeat(64)), /não encontrada/);
  await assert.rejects(service.cobrar(c.id, "b".repeat(64), c.parcelas[0].id, randomUUID(), "point"));
  assert.equal(creates,0);
});

test("duplo clique e chaves diferentes na mesma parcela criam uma cobrança", async () => {
  const c = await draft();
  const key = randomUUID();
  await Promise.all([charge(c.id,c.parcelas[0].id,key), charge(c.id,c.parcelas[0].id,key), charge(c.id,c.parcelas[0].id)]);
  assert.equal(creates,1);
  assert.equal((await service.resumo(c.id,token)).reservado,334);
});

test("terminal reservado bloqueia outra parcela e outro cliente", async () => {
  const c = await draft();
  await charge(c.id,c.parcelas[0].id);
  await assert.rejects(charge(c.id,c.parcelas[1].id), /andamento/);
  const outra = await service.criar({ ...input(), token: "b".repeat(64) });
  const d = await service.resumo(outra,"b".repeat(64));
  await assert.rejects(service.cobrar(d.id,"b".repeat(64),d.parcelas[0].id,randomUUID(),"point"), /andamento/);
  assert.equal(creates,1);
});

test("chave de criação permanece consumida após transferência de sessão",async()=>{
  const c=await draft();await service.retomar(c.id,"empresa");
  await assert.rejects(service.criar(input()),/Sessão transferida/);
  assert.equal((await db.query(`SELECT id FROM "Pedido"`)).length,1);
});

test("retry de criação recupera preço congelado mesmo após mudança no catálogo",async()=>{
  const body={...input(),requestHash:"same-validated-request"};
  const id=await service.criar(body);
  assert.equal(await service.criar({...body,total:11,subtotal:11,itens:[{produtoId:"produto",quantidade:1,preco:11}]}),id);
  assert.equal((await service.resumo(id,token)).total,1000);
  assert.equal((await db.query(`SELECT id FROM "Pedido"`)).length,1);
});

test("timeout mantém reserva e não reenvia nem com outra chave", async () => {
  const c = await draft(); failCreate = true;
  const t = await charge(c.id,c.parcelas[0].id);
  assert.equal(t.status,"DESCONHECIDO");
  await charge(c.id,c.parcelas[0].id);
  assert.equal(creates,1);
  assert.equal((await service.resumo(c.id,token)).saldo,1000);
});

test("webhooks duplicados não contabilizam duas vezes", async () => {
  const c = await draft(); const t = await charge(c.id,c.parcelas[0].id);
  await Promise.all([service.receber(paid(t),"evento"), service.receber(paid(t),"evento")]);
  await service.receber(paid(t),"outro-evento");
  const r = await service.resumo(c.id,token);
  assert.equal(r.pago,334); assert.equal(r.saldo,666); assert.equal(r.status,"ABERTA");
  const [p] = await db.query<{ pago: boolean }>(`SELECT pago FROM "Pedido" WHERE id=$1`,[c.pedidoId]);
  assert.equal(p.pago,false);
});

test("quitação somente após todas as parcelas, estoque/estatística uma vez", async () => {
  const c = await draft();
  for (const p of c.parcelas) {
    const t = await charge(c.id,p.id);
    await service.receber(paid(t),t.id); await service.receber(paid(t),`${t.id}-duplicado`);
  }
  const r = await service.resumo(c.id,token);
  assert.equal(r.pago,1000); assert.equal(r.saldo,0); assert.equal(r.status,"QUITADA");
  const [p] = await db.query<{ pago: boolean; status: string }>(`SELECT pago,status FROM "Pedido" WHERE id=$1`,[c.pedidoId]);
  assert.equal(p.pago,true); assert.equal(p.status,"RECEBIDO");
  const [s] = await db.query<{ estoqueAtual: string }>(`SELECT "estoqueAtual" FROM insumos WHERE id='insumo'`);
  assert.equal(Number(s.estoqueAtual),9);
  assert.equal((await db.query(`SELECT id FROM movimentacoes_estoque`)).length,1);
  const [cliente] = await db.query<{ totalGasto: string }>(`SELECT "totalGasto" FROM clientes WHERE id='cliente'`);
  assert.equal(Number(cliente.totalGasto),10);
  assert.equal((await db.query(`SELECT id FROM "Pagamento"`)).length,0);
});

test("desligar flag preserva webhook e recuperação de pagamento iniciado", async () => {
  const c = await draft(); failCreate = true;
  const t = await charge(c.id,c.parcelas[0].id);
  enabled = false; consulta = paid(t);
  await assert.rejects(charge(c.id,c.parcelas[1].id), /desativadas/);
  await service.reconciliar(c.id,token);
  assert.equal((await service.resumo(c.id,token)).pago,334);
});

test("valor ou moeda divergente bloqueia a conta em revisão", async () => {
  const c = await draft(); const t = await charge(c.id,c.parcelas[0].id);
  await service.receber({ ...paid(t), valorCentavos: t.valor+1 },"divergente");
  const r = await service.resumo(c.id,token);
  assert.equal(r.pago,0); assert.equal(r.status,"REVISAO");
  await assert.rejects(charge(c.id,c.parcelas[1].id), /revisão/);
});

test("mesmo paymentId em parcelas diferentes não é recebido novamente", async () => {
  const c = await draft(); const a = await charge(c.id,c.parcelas[0].id);
  await service.receber(paid(a,"mesmo-payment"),"a");
  const b = await charge(c.id,c.parcelas[1].id);
  await service.receber(paid(b,"mesmo-payment"),"b");
  const r = await service.resumo(c.id,token);
  assert.equal(r.pago,334); assert.equal(r.status,"REVISAO");
});

test("recusa permite nova tentativa; evento antigo não desfaz aprovação", async () => {
  const c = await draft(); const a = await charge(c.id,c.parcelas[0].id);
  await service.receber({ referencia:a.referencia,status:"FAILED" },"recusa");
  const b = await charge(c.id,c.parcelas[0].id);
  assert.equal(creates,2);
  await service.receber(paid(b),"pago");
  await service.receber({ referencia:b.referencia,status:"FAILED" },"recusa-atrasada");
  assert.equal((await service.resumo(c.id,token)).pago,334);
});

test("aprovação tardia com outra tentativa ativa congela sem quitar", async () => {
  const c = await draft(); const a = await charge(c.id,c.parcelas[0].id);
  await service.receber({ referencia:a.referencia,status:"FAILED" },"recusa");
  await charge(c.id,c.parcelas[0].id);
  await service.receber(paid(a),"aprovacao-tardia");
  assert.equal((await service.resumo(c.id,token)).status,"REVISAO");
});

test("backstop SQL impede integral, cancelamento e fechamento antecipado", async () => {
  const c = await draft();
  await assert.rejects(db.query(`INSERT INTO "Pagamento" (id,"pedidoId",metodo,valor,status) VALUES ('integral',$1,'PIX',10,'APROVADO') RETURNING id`,[c.pedidoId]),/divisão/);
  await assert.rejects(db.query(`UPDATE "Pedido" SET status='CANCELADO' WHERE id=$1 RETURNING id`,[c.pedidoId]),/dividido/);
  await assert.rejects(db.query(`UPDATE "Pedido" SET pago=TRUE WHERE id=$1 RETURNING id`,[c.pedidoId]),/quitada/);
  await assert.rejects(db.query(`UPDATE caixas SET status='FECHADO' WHERE id='caixa' RETURNING id`),/divisão/);
});

test("pagamentos integrais comuns continuam aceitos pelos triggers", async () => {
  await db.query(`INSERT INTO "Pedido" (id,"empresaId",senha,subtotal,total,"atualizadoEm") VALUES ('comum','empresa','CB-1',10,10,CURRENT_TIMESTAMP) RETURNING id`);
  await db.query(`INSERT INTO "Pagamento" (id,"pedidoId",metodo,valor,status) VALUES ('integral','comum','PIX',10,'APROVADO') RETURNING id`);
  await db.query(`UPDATE "Pedido" SET pago=TRUE,status='RECEBIDO' WHERE id='comum' RETURNING id`);
  assert.equal((await db.query(`SELECT id FROM "Pagamento" WHERE id='integral'`)).length,1);
});

test("operação legada em voo impede reserva de parcela", async () => {
  const c = await draft();
  await db.query(`INSERT INTO "DivisaoOperacaoLegada" (id) VALUES ('lease') RETURNING id`);
  await assert.rejects(charge(c.id,c.parcelas[0].id),/andamento/);
  assert.equal(creates,0);
});

test("evento persistido é recuperado após falha transacional", async () => {
  const c = await draft(); const t = await charge(c.id,c.parcelas[0].id);
  let fail = true;
  const failingDb: Database = { ...db, transaction: async <T>(fn: (tx: Sql) => Promise<T>) => {
    if (fail) throw new Error("database temporarily unavailable");
    return db.transaction(fn);
  } };
  const interrupted = criarServico(failingDb,provider,()=>false);
  await assert.rejects(interrupted.receber(paid(t),"persistido"));
  assert.equal((await db.query(`SELECT id FROM "EventoParcela" WHERE NOT processado`)).length,1);
  fail = false; await interrupted.recuperarTudo();
  assert.equal((await service.resumo(c.id,token)).pago,334);
});

test("estorno após aprovação exige revisão sem reenviar ao preparo", async () => {
  const c = await draft(); let last: Tentativa;
  for (const p of c.parcelas) { last = await charge(c.id,p.id); await service.receber(paid(last),last.id); }
  await service.receber({ referencia:last!.referencia,status:"REVIEW" },"estorno");
  assert.equal((await service.resumo(c.id,token)).status,"REVISAO");
  assert.equal((await db.query(`SELECT id FROM movimentacoes_estoque`)).length,1);
});

test("guardas preservam integral antes da migration e para pedido comum", async () => {
  let chamadas = 0;
  const handler = async () => { chamadas++; return Response.json({ ok: true, data: { legacy: true } }); };
  const antes = criarGuardas(db,async()=>false);
  assert.equal(await antes.protegerPedido("comum"),null);
  assert.equal((await antes.executarLegado(handler)).status,200);
  const depois = criarGuardas(db,async()=>true);
  assert.equal(await depois.protegerPedido("comum"),null);
  assert.equal((await depois.executarLegado(handler)).status,200);
  assert.equal(chamadas,2);
  assert.equal((await db.query(`SELECT id FROM "DivisaoOperacaoLegada"`)).length,0);
});

test("guardas bloqueiam pedido vinculado e terminal antes da chamada externa", async () => {
  const c = await draft(); const guards = criarGuardas(db,async()=>true);
  assert.equal((await guards.protegerPedido(c.pedidoId))?.status,409);
  await charge(c.id,c.parcelas[0].id);
  let chamou = false;
  const resposta = await guards.executarLegado(async()=>{ chamou=true; return Response.json({ok:true}); });
  assert.equal(resposta.status,409); assert.equal(chamou,false);
});

test("corrida entre integral e parcial mantém exclusão sem transação remota", async () => {
  const c = await draft(); const guards = criarGuardas(db,async()=>true);
  let libera!: () => void; let entrou!: () => void;
  const pronto = new Promise<void>(resolve=>{entrou=resolve;});
  const espera = new Promise<void>(resolve=>{libera=resolve;});
  const integral = guards.executarLegado(async()=>{entrou(); await espera; return Response.json({ok:true});});
  await pronto;
  await assert.rejects(charge(c.id,c.parcelas[0].id),/andamento/);
  libera(); await integral;
  await charge(c.id,c.parcelas[0].id);
  assert.equal(creates,1);
});

test("falha legada conserva lease e impede divisão especulativa", async () => {
  const c = await draft(); const guards = criarGuardas(db,async()=>true);
  assert.equal((await guards.executarLegado(async()=>Response.json({ok:false},{status:500}))).status,500);
  await assert.rejects(charge(c.id,c.parcelas[0].id),/andamento/);
  assert.equal(creates,0);
});

test("roles públicas não leem ledger, tokens ou eventos", async () => {
  await draft();
  for (const role of ["anon","authenticated"]) {
    await pg.exec(`SET ROLE ${role}`);
    try { await assert.rejects(db.query(`SELECT * FROM "ContaDividida"`),/permission denied/); }
    finally { await pg.exec(`RESET ROLE`); }
  }
});

test("webhook antes da resposta de criação encontra a tentativa persistida", async () => {
  const c = await draft();
  const rapido: Provedor = { ...provider, async criar(i) {
    await service.receber({referencia:i.referencia,status:"PAID",paymentId:"instantaneo",intentId:"intent-rapido",valorCentavos:i.valorCentavos,moeda:"BRL",metodo:"CARTAO_DEBITO"},"rapido");
    return {intentId:"intent-rapido"};
  } };
  const fast = criarServico(db,rapido,()=>true);
  await fast.cobrar(c.id,token,c.parcelas[0].id,randomUUID(),"point");
  assert.equal((await service.resumo(c.id,token)).pago,334);
  const [t] = await db.query<Tentativa>(`SELECT * FROM "TentativaParcela"`);
  assert.equal(t.status,"APROVADO"); assert.equal(t.intentId,"intent-rapido");
});

test("falha no estoque reverte quitação inteira e replay conclui uma vez", async () => {
  const c = await draft();
  for (const p of c.parcelas.slice(0,2)) {const t=await charge(c.id,p.id); await service.receber(paid(t),t.id);}
  const ultimo = await charge(c.id,c.parcelas[2].id);
  let fail = true;
  const interrompido: Database = { ...db, transaction: fn => db.transaction(tx => fn({query: async <T>(sql: string, values?: unknown[]) => {
    if (fail && sql.includes('INSERT INTO movimentacoes_estoque')) throw new Error("stock write interrupted");
    return tx.query<T>(sql,values);
  }})) };
  const recovery = criarServico(interrompido,provider,()=>false);
  await assert.rejects(recovery.receber(paid(ultimo),"ultimo"),/interrupted/);
  assert.equal((await service.resumo(c.id,token)).status,"ABERTA");
  const [p] = await db.query<{pago:boolean}>(`SELECT pago FROM "Pedido" WHERE id=$1`,[c.pedidoId]); assert.equal(p.pago,false);
  assert.equal((await db.query(`SELECT id FROM movimentacoes_estoque`)).length,0);
  fail=false; await recovery.recuperarTudo();
  assert.equal((await service.resumo(c.id,token)).status,"QUITADA");
  assert.equal((await db.query(`SELECT id FROM movimentacoes_estoque`)).length,1);
});

test("moeda divergente não aprova parcela", async () => {
  const c=await draft(); const t=await charge(c.id,c.parcelas[0].id);
  await service.receber({...paid(t),moeda:"USD"},"moeda-incorreta");
  const r=await service.resumo(c.id,token); assert.equal(r.pago,0); assert.equal(r.status,"REVISAO");
});

test("revisão de estorno histórico não ocupa a maquininha de pedidos comuns", async () => {
  const c=await draft(); let t: Tentativa;
  for(const p of c.parcelas){t=await charge(c.id,p.id); await service.receber(paid(t),t.id);}
  await service.receber({referencia:t!.referencia,status:"REVIEW"},"refund");
  const guards=criarGuardas(db,async()=>true);
  assert.equal((await guards.executarLegado(async()=>Response.json({ok:true}))).status,200);
  assert.equal((await service.resumo(c.id,token)).status,"REVISAO");
});

test("adaptador Point envia centavos/referência e não repete POST em erro", async () => {
  let chamadas=0;
  globalThis.fetch=async(url,options)=>{
    chamadas++;
    assert.ok(String(url).endsWith('/devices/terminal-falso/payment-intents'));
    const body=JSON.parse(String(options?.body)); assert.equal(body.amount,334); assert.equal(body.additional_info.external_reference,"DC-teste");
    assert.equal(new Headers(options?.headers).get("X-Idempotency-Key"),"DC-teste");
    return new Response(JSON.stringify({message:"simulated failure"}),{status:500,headers:{"Content-Type":"application/json"}});
  };
  await assert.rejects(mercadoPagoDivisao.criar({referencia:"DC-teste",valorCentavos:334,deviceId:"terminal-falso"}));
  assert.equal(chamadas,1);
});

test("adaptador consulta API simulada e reconhece aprovação/estorno parcial", async () => {
  let refunded=0;
  globalThis.fetch=async(url)=>{
    assert.ok(String(url).includes('/v1/payments/123'));
    return Response.json({id:123,external_reference:"DC-teste",status:"approved",transaction_amount:3.34,transaction_amount_refunded:refunded,currency_id:"BRL",payment_type_id:"debit_card"});
  };
  const pago=await resultadoPayment("123"); assert.equal(pago.status,"PAID"); assert.equal(pago.valorCentavos,334); assert.equal(pago.metodo,"CARTAO_DEBITO");
  refunded=1; assert.equal((await resultadoPayment("123")).status,"REVIEW");
});

test("divisão sem tentativa pode ser cancelada sem apagar consumo ou impedir caixa", async () => {
  const c=await draft(); enabled=false;
  await service.cancelar(c.id,token); await service.cancelar(c.id,token);
  assert.equal((await service.resumo(c.id,token)).status,"CANCELADA");
  const [p]=await db.query<{status:string}>(`SELECT status FROM "Pedido" WHERE id=$1`,[c.pedidoId]); assert.equal(p.status,"CANCELADO");
  assert.equal((await db.query(`SELECT id FROM "ItemPedido"`)).length,1);
  await db.query(`UPDATE caixas SET status='FECHADO' WHERE id='caixa' RETURNING id`);
});

test("divisão com qualquer tentativa não pode ser cancelada pelo cliente", async () => {
  const c=await draft(); const t=await charge(c.id,c.parcelas[0].id);
  await assert.rejects(service.cancelar(c.id,token),/iniciou cobrança/);
  await service.receber({referencia:t.referencia,status:"FAILED"},"recusa");
  await assert.rejects(service.cancelar(c.id,token),/iniciou cobrança/);
});

test("retomada administrativa verifica empresa, gira token e não cria cobrança",async()=>{
  const c=await draft();const t=await charge(c.id,c.parcelas[0].id);
  await assert.rejects(service.retomar(c.id,"outra-empresa"),/não encontrada/);
  enabled=false;const sessao=await service.retomar(c.id,"empresa");
  await assert.rejects(service.resumo(c.id,token),/não encontrada/);
  assert.equal((await service.resumo(c.id,sessao.token)).reservado,334);
  await service.receber(paid(t),"pagamento-apos-retomada");
  assert.equal((await service.resumo(c.id,sessao.token)).pago,334);
  assert.equal(creates,1);
});

async function pedidoComum() {
  await db.query(`INSERT INTO "Pedido" (id,"empresaId",senha,subtotal,total,"atualizadoEm") VALUES ('comum','empresa','CB-999',10,10,CURRENT_TIMESTAMP) RETURNING id`);
}

function prismaLegado() {
  return {
    pedido: {
      findUnique: async({where}:{where:{id:string}})=>(await db.query<{id:string;total:string}>(`SELECT * FROM "Pedido" WHERE id=$1`,[where.id]))[0] ?? null,
      updateMany: async()=>({count:0}),
    },
    pagamento: {
      findMany: async()=>[],
      create: async({data}:{data:{pedidoId:string;referencia:string;status:string;valor:number;metodo:string;payload?:unknown}})=>{
        const [p]=await db.query(`INSERT INTO "Pagamento" (id,"pedidoId",referencia,status,valor,metodo,payload) VALUES ($1,$2,$3,$4::"StatusPagamento",$5,$6::"MetodoPagamento",$7::jsonb) RETURNING *`,[randomUUID(),data.pedidoId,data.referencia,data.status,data.valor,data.metodo,JSON.stringify(data.payload ?? null)]);
        return p;
      },
    },
  };
}

test("rota MP integral preserva contrato com flag desligada antes e depois do SQL",async()=>{
  for(const pronta of [false,true]) {
    await db.query(`DELETE FROM "Pagamento" RETURNING id`);
    if(!pronta)await pedidoComum();
    let chamadas=0;
    const guards=criarGuardas(db,async()=>pronta);
    const route=await carregarRota("app/api/pagamentos/mp/criar/route.ts",{
      "@/lib/prisma":{prisma:prismaLegado()},"@/lib/dividir-conta/guards":guards,
      "@/lib/mp-pagamento":{reconciliarPagamentoMp:async()=>{throw new Error("unexpected reconciliation");}},
      "@/lib/mercadopago":{
        obterDevicePoint:async()=>"point-comum",
        criarPagamentoPoint:async(p:{valor:number;referencia:string;deviceId:string;semRetentativa?:boolean})=>{
          chamadas++;assert.equal(p.valor,10);assert.equal(p.deviceId,"point-comum");assert.equal(p.referencia,"CB-integral");assert.equal(p.semRetentativa,undefined);
          return {id:"intent-integral",state:"OPEN"};
        },
      },
    });
    const r=await route.POST(requisicao({pedidoId:"comum",referencia:"CB-integral",metodo:"PIX",valor:0.01}));
    assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,data:{checkoutId:"intent-integral",readerId:"point-comum",metodo:"MAQUININHA",status:"OPEN"}});
    assert.equal(chamadas,1);
    const [p]=await db.query<{valor:string;status:string}>(`SELECT valor,status FROM "Pagamento"`);assert.equal(Number(p.valor),10);assert.equal(p.status,"PENDENTE");
    assert.equal((await db.query(`SELECT id FROM "DivisaoOperacaoLegada"`)).length,0);
  }
});

test("rota MP não chama terminal para pedido dividido mesmo com flag desligada",async()=>{
  const c=await draft();let chamadas=0;enabled=false;
  const route=await carregarRota("app/api/pagamentos/mp/criar/route.ts",{
    "@/lib/prisma":{prisma:prismaLegado()},"@/lib/dividir-conta/guards":criarGuardas(db,async()=>true),
    "@/lib/mp-pagamento":{},"@/lib/mercadopago":{obterDevicePoint:async()=>{chamadas++;return "point";}},
  });
  const r=await route.POST(requisicao({pedidoId:c.pedidoId,referencia:"integral-bloqueado"}));
  assert.equal(r.status,409);assert.equal(chamadas,0);
});

test("rota MP mantém erros de validação e não deixa lease para HTTP 400",async()=>{
  const route=await carregarRota("app/api/pagamentos/mp/criar/route.ts",{
    "@/lib/prisma":{prisma:prismaLegado()},"@/lib/dividir-conta/guards":criarGuardas(db,async()=>true),
    "@/lib/mp-pagamento":{},"@/lib/mercadopago":{},
  });
  const r=await route.POST(requisicao({}));assert.equal(r.status,400);assert.equal((await r.json()).error,"Dados inválidos");
  assert.equal((await db.query(`SELECT id FROM "DivisaoOperacaoLegada"`)).length,0);
});

test("rota MP preserva erro do provedor e conserva lease em resultado desconhecido",async()=>{
  await pedidoComum();
  const route=await carregarRota("app/api/pagamentos/mp/criar/route.ts",{
    "@/lib/prisma":{prisma:prismaLegado()},"@/lib/dividir-conta/guards":criarGuardas(db,async()=>true),
    "@/lib/mp-pagamento":{},"@/lib/mercadopago":{obterDevicePoint:async()=>"point",criarPagamentoPoint:async()=>{throw new Error("simulated timeout");}},
  });
  const r=await route.POST(requisicao({pedidoId:"comum",referencia:"CB-erro"}));assert.equal(r.status,500);assert.equal((await r.json()).error,"simulated timeout");
  assert.equal((await db.query(`SELECT id FROM "DivisaoOperacaoLegada"`)).length,1);
});

test("SDK integral mantém retentativa original, parcial não a herda",async()=>{
  let chamadas=0;
  globalThis.fetch=async()=>{
    chamadas++;
    return chamadas===1 ? new Response("{}",{status:429,headers:{"Retry-After":"0"}}) : Response.json({id:"intent-apos-retry",state:"OPEN"});
  };
  assert.equal((await criarPagamentoPoint({valor:10,referencia:"CB-retry",descricao:"Integral",deviceId:"point"})).id,"intent-apos-retry");
  assert.equal(chamadas,2);
});

test("SumUp histórica: contrato integral físico permanece sem chamar MP",async()=>{
  await pedidoComum();let chamadas=0;
  const route=await carregarRota("app/api/pagamentos/sumup/criar/route.ts",{
    "@/lib/prisma":{prisma:prismaLegado()},"@/lib/dividir-conta/guards":criarGuardas(db,async()=>true),
    "@/lib/sumup":{getReaders:async()=>[{id:"sumup-reader",status:"online"}],enviarParaMaquininha:async(reader:string,valor:number)=>{chamadas++;assert.equal(reader,"sumup-reader");assert.equal(valor,10);return{id:"sumup-checkout",status:"PENDING"};}},
  });
  const r=await route.POST(requisicao({pedidoId:"comum",referencia:"SUMUP-historico",metodo:"PIX",valor:0.01}));
  assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,data:{checkoutId:"sumup-checkout",readerId:"sumup-reader",metodo:"MAQUININHA",status:"PENDING"}});assert.equal(chamadas,1);
});

test("SumUp histórica: fallback online e bloqueio de pedido dividido preservados",async()=>{
  await pedidoComum();let chamadas=0;
  const route=await carregarRota("app/api/pagamentos/sumup/criar/route.ts",{
    "@/lib/prisma":{prisma:prismaLegado()},"@/lib/dividir-conta/guards":criarGuardas(db,async()=>true),
    "@/lib/sumup":{getReaders:async()=>[],criarCheckout:async(p:{valor:number})=>{chamadas++;assert.equal(p.valor,10);return{id:"checkout-online",status:"PENDING",checkout_url:"https://simulated.invalid/pay"};}},
  });
  const r=await route.POST(requisicao({pedidoId:"comum",referencia:"SUMUP-fallback"}));assert.equal(r.status,200);assert.equal((await r.json()).data.checkoutUrl,"https://simulated.invalid/pay");
  const c=await draft();const bloqueada=await route.POST(requisicao({pedidoId:c.pedidoId,referencia:"SUMUP-bloqueado"}));assert.equal(bloqueada.status,409);assert.equal(chamadas,1);
});

test("webhook MP legado mantém aprovação e referências DC que não pertencem à divisão",async()=>{
  for(const referencia of ["CB-legado","DC-historica",`DC-${randomUUID()}`]){
    let aplicadas=0;
    const route=await carregarRota("app/api/pagamentos/mp/webhook/route.ts",{
      "@/lib/mercadopago":{validarAssinaturaWebhook:()=>true,consultarPagamentoMp:async()=>({referencia,status:"PAID",paymentId:"123"})},
      "@/lib/mp-pagamento":{aplicarPagamentoCheckoutPro:async()=>false,aplicarResultadoMp:async(ref:string)=>{assert.equal(ref,referencia);aplicadas++;}},
      "@/lib/dividir-conta/runtime":{},"@/lib/dividir-conta/mercadopago":{},"@/lib/dividir-conta/guards":criarGuardas(db,async()=>true),
    });
    assert.equal((await route.POST(requisicao({type:"payment",data:{id:"123"}}))).status,200);assert.equal(aplicadas,1);
  }
});

test("webhook MP de intenção comum e alias antigo continuam compatíveis",async()=>{
  let chamadas=0;
  const handler=await carregarRota("app/api/pagamentos/mp/webhook/route.ts",{
    "@/lib/mercadopago":{validarAssinaturaWebhook:()=>true,verificarPagamentoPoint:async()=>({referencia:"CB-intent",status:"PAID"})},
    "@/lib/mp-pagamento":{aplicarResultadoMp:async()=>{chamadas++;}},"@/lib/dividir-conta/runtime":{},"@/lib/dividir-conta/mercadopago":{},"@/lib/dividir-conta/guards":criarGuardas(db,async()=>true),
  });
  const alias=await carregarRota("app/api/pagamentos/mercadopago/webhook/route.ts",{"@/app/api/pagamentos/mp/webhook/route":handler});
  assert.equal(alias.POST,handler.POST);assert.equal((await alias.POST(requisicao({type:"point_integration_wh",data:{id:"intent"}}))).status,200);assert.equal(chamadas,1);
});

test("webhook MP de parcela reconhecida concilia com flag desligada",async()=>{
  const c=await draft();const t=await charge(c.id,c.parcelas[0].id);enabled=false;
  const route=await carregarRota("app/api/pagamentos/mp/webhook/route.ts",{
    "@/lib/mercadopago":{validarAssinaturaWebhook:()=>true,consultarPagamentoMp:async()=>({referencia:t.referencia,status:"PAID"})},
    "@/lib/mp-pagamento":{},"@/lib/dividir-conta/runtime":{divisao:service,notificarQuitadas:async()=>{}},
    "@/lib/dividir-conta/mercadopago":{resultadoPayment:async()=>paid(t)},"@/lib/dividir-conta/guards":criarGuardas(db,async()=>true),
  });
  assert.equal((await route.POST(requisicao({type:"payment",data:{id:"123"}}))).status,200);
  assert.equal((await service.resumo(c.id,token)).pago,334);
});

test("webhook MP continua rejeitando assinatura inválida antes de consultar provedor",async()=>{
  const route=await carregarRota("app/api/pagamentos/mp/webhook/route.ts",{
    "@/lib/mercadopago":{validarAssinaturaWebhook:()=>false},"@/lib/mp-pagamento":{},"@/lib/dividir-conta/runtime":{},"@/lib/dividir-conta/mercadopago":{},"@/lib/dividir-conta/guards":{},
  });
  assert.equal((await route.POST(requisicao({type:"payment",data:{id:"123"}}))).status,401);
});

test("webhook SumUp histórico mantém processamento sem recursos novos",async()=>{
  let aprovacoes=0;let liberacoes=0;
  const route=await carregarRota("app/api/pagamentos/sumup/webhook/route.ts",{
    "@/lib/prisma":{prisma:{pagamento:{updateMany:async()=>{aprovacoes++;return{count:1};},findFirst:async()=>({pedidoId:"historico"})}}},
    "@/lib/sumup":{verificarCheckout:async()=>({status:"PAID",checkout_reference:"SUMUP-historico"})},"@/lib/liberar-pedido":{liberarPedidoPago:async()=>{liberacoes++;}},
  });
  assert.equal((await route.POST(requisicao({id:"checkout"}))).status,200);assert.equal(aprovacoes,1);assert.equal(liberacoes,1);
});

test("flag desligada oculta opção sem consultar banco ou token MP",async()=>{
  const config=await carregarRota("app/api/pagamentos/dividir/config/route.ts",{
    "@/lib/dividir-conta/database":{habilitada:()=>false,estruturaPronta:async()=>{throw new Error("must not access database");}},
  });
  const response=await config.GET(new Request("https://isolated.invalid/config"));assert.deepEqual(await response.json(),{ok:true,enabled:false});
});

test("flag desligada rejeita nova parcela antes de consultar banco ou Point",async()=>{
  const {z}=await import("zod");
  const route=await carregarRota("app/api/pagamentos/dividir/[id]/cobrar/route.ts",{
    zod:{z},"@/lib/mercadopago":{},"@/lib/dividir-conta/database":{habilitada:()=>false},"@/lib/dividir-conta/runtime":{},
    "@/lib/dividir-conta/domain":await import("../../lib/dividir-conta/domain"),
    "@/lib/dividir-conta/http":{tokenRequest:()=>"",respostaDivisao:Response.json.bind(Response),tratar:async(fn:()=>Promise<Response>)=>{try{return await fn();}catch{return Response.json({ok:false},{status:403});}}},
  });
  assert.equal((await route.POST(requisicao({}),{params:Promise.resolve({id:"test"})})).status,403);
});
