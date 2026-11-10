import { randomUUID } from "node:crypto";
import { DivisaoError } from "./domain";
import type { Database } from "./domain";
import { lock } from "./service";

// Injectable so regression/concurrency tests never import Prisma or a payment SDK.
export function criarGuardas(db: Database, estruturaPronta: () => Promise<boolean>) {
  async function protegerPedido(pedidoId: string): Promise<Response | null> {
    if (!await estruturaPronta()) return null;
    const rows = await db.query(`SELECT id FROM "ContaDividida" WHERE "pedidoId"=$1`, [pedidoId]);
    return rows.length ? Response.json({ ok: false, error: "Este pedido possui divisão de conta. Continue pelo acompanhamento das parcelas." }, { status: 409 }) : null;
  }
  async function referenciaDividida(referencia: string): Promise<boolean> {
    // Prefixes are not ownership. Historical integrations may already use DC-*.
    if (!/^DC-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(referencia)) return false;
    if (!await estruturaPronta()) return false;
    const rows = await db.query(`SELECT id FROM "TentativaParcela" WHERE referencia=$1`, [referencia]);
    return rows.length > 0;
  }
  async function executarLegado(fn: () => Promise<Response>) {
    if (!await estruturaPronta()) return fn();
    const id = randomUUID();
    try {
      await db.transaction(async tx => {
        await lock(tx);
        const ativas = await tx.query(`SELECT id FROM "TentativaParcela" WHERE status IN ('CRIANDO','PENDENTE','DESCONHECIDO') LIMIT 1`);
        if (ativas.length) throw new DivisaoError("Maquininha reservada para uma parcela. Aguarde a confirmação.");
        await tx.query(`INSERT INTO "DivisaoOperacaoLegada" (id) VALUES ($1) RETURNING id`, [id]);
      });
      const response = await fn();
      const body = await response.clone().json().catch(() => null);
      // Current legacy handler returns validation errors before any external call.
      if (body?.ok === true || response.status < 500) {
        try { await db.query(`DELETE FROM "DivisaoOperacaoLegada" WHERE id=$1 RETURNING id`, [id]); }
        catch { /* Keep the lease, but never turn a known legacy success into a failed charge. */ }
      }
      return response;
    } catch (e) {
      if (e instanceof DivisaoError) return Response.json({ ok: false, error: e.message }, { status: e.status });
      return Response.json({ ok: false, error: "Não foi possível verificar a disponibilidade da maquininha" }, { status: 503 });
    }
  }
  return { protegerPedido, executarLegado, referenciaDividida };
}
