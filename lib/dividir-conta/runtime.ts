import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { db, habilitada, estruturaPronta } from "./database";
import { criarServico } from "./service";
import { mercadoPagoDivisao } from "./mercadopago";

export const divisao = criarServico(db, mercadoPagoDivisao, habilitada);

// Retried by status queries, webhooks and the authenticated recovery endpoint.
// Financial settlement/stock are already committed; broadcasting is safe to repeat.
export async function notificarQuitadas() {
  const contas = await db.query<{ id: string; pedidoId: string }>(`SELECT id,"pedidoId" FROM "ContaDividida" WHERE status='QUITADA' AND NOT notificada LIMIT 20`);
  for (const conta of contas) {
    const pedido = await prisma.pedido.findUnique({ where: { id: conta.pedidoId }, include: { itens: { include: { produto: true, adicionais: { include: { adicional: true } } } } } });
    if (!pedido) continue;
    const result = await supabaseAdmin.channel(`empresa-${pedido.empresaId}`).send({ type: "broadcast", event: "pedido:novo", payload: pedido });
    if (result === "ok") await db.query(`UPDATE "ContaDividida" SET notificada=TRUE WHERE id=$1 RETURNING id`, [conta.id]);
  }
}

export async function recuperarDivisoes() {
  if (!await estruturaPronta()) return;
  await divisao.recuperarTudo();
  await notificarQuitadas();
}
