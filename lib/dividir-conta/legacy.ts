import { randomUUID } from "node:crypto";
import { DivisaoError } from "./domain";
import type { Database } from "./domain";
import { lock } from "./service";

// Injectable so regression/concurrency tests never import Prisma or a payment SDK.
export function criarGuardas(
  db: Database,
  estruturaPronta: () => Promise<boolean>,
  habilitada: () => boolean = () => true,
) {
  async function protegerPedido(pedidoId: string): Promise<Response | null> {
    // Existing split accounts must remain protected even if the flag is later
    // turned off. Orders without a split only incur this indexed existence read;
    // no reservation or transaction is created for the integral payment path.
    if (!await estruturaPronta()) return null;
    let rows: { id: string }[];
    try {
      rows = await db.query(`SELECT id FROM "ContaDividida" WHERE "pedidoId"=$1 LIMIT 1`, [pedidoId]);
    } catch {
      // Fail closed before the provider call if the production role cannot read
      // the table used by the database trigger.
      return Response.json({ ok: false, error: "Não foi possível validar se o pedido possui divisão" }, { status: 503 });
    }
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
    // The old full-payment flow is intentionally independent of split storage
    // while the feature is disabled. Webhook/recovery paths remain ungated.
    if (!habilitada()) return fn();
    if (!await estruturaPronta()) return fn();
    const id = randomUUID();
    try {
      await db.transaction(async tx => {
        await lock(tx);
        // Integral handlers already call protegerPedido BEFORE provider I/O.
        // A pending split reserves its own order, not every independent sale.
        // Keep the lease protecting split creation while integral I/O is in flight.
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
