import { q, sessaoChamados } from "@/lib/chamados";
import { buscarChamado } from "@/lib/chamados-acesso";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; eventoId: string }> }) {
  const s = await sessaoChamados();
  if (!s) return new Response("Não autenticado", { status: 401 });
  const { id, eventoId } = await ctx.params;
  if (!await buscarChamado(id, s)) return new Response("Não encontrado", { status: 404 });
  const [e] = await q<{ anexoDados: string | null }>(`SELECT "anexoDados" FROM "ChamadoEvento" WHERE id = $1 AND "chamadoId" = $2`, [eventoId, id]);
  const m = e?.anexoDados?.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!m) return new Response("Sem anexo", { status: 404 });
  return new Response(Buffer.from(m[2], "base64"), { headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
