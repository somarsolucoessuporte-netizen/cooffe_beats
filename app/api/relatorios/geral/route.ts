import { NextResponse } from "next/server";
import { sessaoChamados } from "@/lib/chamados";
import { montarRelatorio, SECOES } from "@/lib/relatorios-dados";

/** Acesso: administrador da loja e equipe da Somar. Sempre restrito à empresa da sessão. */
export async function GET(req: Request) {
  try {
    const s = await sessaoChamados();
    if (!s) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    if (s.perfil !== "ADMIN" && !s.somar) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    const sp = new URL(req.url).searchParams;
    const inicio = sp.get("inicio") ?? "", fim = sp.get("fim") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) return NextResponse.json({ ok: false, error: "Informe o período" }, { status: 400 });
    const secoes = await montarRelatorio(s.empresaId, inicio, fim, s.somar);
    return NextResponse.json({ ok: true, data: { secoes: secoes.map(x => ({ ...x, total: x.linhas.length, linhas: x.linhas.slice(0, 100) })), disponiveis: SECOES } });
  } catch (e) {
    console.error("[Relatórios]", e);
    return NextResponse.json({ ok: false, error: e instanceof Error && /Período/.test(e.message) ? e.message : "Não foi possível gerar o relatório" }, { status: 500 });
  }
}
