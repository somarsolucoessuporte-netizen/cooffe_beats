import { NextResponse } from "next/server";
import { q, sessaoChamados } from "@/lib/chamados";

export async function GET() {
  try {
    const s = await sessaoChamados();
    if (!s?.somar) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    const [geral] = await q<{ abertos: number; novos: number; urgentes: number; primeiraRespostaSeg: number | null; solucaoSeg: number | null }>(`
      SELECT COUNT(*) FILTER (WHERE status NOT IN ('RESOLVIDO','FECHADO'))::int AS abertos,
             COUNT(*) FILTER (WHERE status = 'ABERTO' AND "primeiraRespostaEm" IS NULL)::int AS novos,
             COUNT(*) FILTER (WHERE status NOT IN ('RESOLVIDO','FECHADO') AND prioridade = 'URGENTE')::int AS urgentes,
             AVG(EXTRACT(EPOCH FROM ("primeiraRespostaEm" - "abertoEm")))::float AS "primeiraRespostaSeg",
             AVG(EXTRACT(EPOCH FROM ("resolvidoEm" - "abertoEm"))) FILTER (WHERE "resolvidoEm" IS NOT NULL)::float AS "solucaoSeg"
      FROM "Chamado"`);
    const porMotivo = await q<{ motivo: string; total: number }>(`SELECT motivo, COUNT(*)::int AS total FROM "Chamado" GROUP BY 1 ORDER BY 2 DESC`);
    const porMes = await q<{ mes: string; total: number }>(`SELECT to_char("abertoEm" AT TIME ZONE 'America/Sao_Paulo','YYYY-MM') AS mes, COUNT(*)::int AS total FROM "Chamado" GROUP BY 1 ORDER BY 1 DESC LIMIT 12`);
    return NextResponse.json({ ok: true, data: { ...geral, porMotivo, porMes } });
  } catch (e) {
    console.error("[Chamados indicadores]", e);
    return NextResponse.json({ ok: false, error: "Não foi possível calcular os indicadores" }, { status: 500 });
  }
}
