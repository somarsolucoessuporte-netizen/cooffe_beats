import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { sessaoChamados } from "@/lib/chamados";
import { montarRelatorio, SECOES, type Secao } from "@/lib/relatorios-dados";

export const maxDuration = 60;

const csvCelula = (v: string | number | null) => {
  let t = v == null ? "" : typeof v === "number" ? String(v).replace(".", ",") : v;
  // Evita que o Excel execute texto que começa com fórmula
  if (typeof v === "string" && /^[=+\-@]/.test(t)) t = "'" + t;
  return /[";\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const csvLinhas = (s: Secao) => [s.colunas, ...s.linhas].map(l => l.map(csvCelula).join(";")).join("\r\n");

/** GET ?formato=xlsx|csv &secao=<id>|tudo &inicio=YYYY-MM-DD &fim=YYYY-MM-DD */
export async function GET(req: Request) {
  try {
    const s = await sessaoChamados();
    if (!s) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    if (s.perfil !== "ADMIN" && !s.somar) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    const sp = new URL(req.url).searchParams;
    const inicio = sp.get("inicio") ?? "", fim = sp.get("fim") ?? "";
    const formato = sp.get("formato") === "csv" ? "csv" : "xlsx";
    const secaoId = sp.get("secao") ?? "tudo";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) return NextResponse.json({ ok: false, error: "Informe o período" }, { status: 400 });
    if (secaoId !== "tudo" && !SECOES.some(x => x.id === secaoId)) return NextResponse.json({ ok: false, error: "Seção inválida" }, { status: 400 });

    const secoes = await montarRelatorio(s.empresaId, inicio, fim, s.somar, secaoId === "tudo" ? undefined : [secaoId]);
    const nome = `relatorio-${secaoId}-${inicio}_a_${fim}`;

    if (formato === "csv") {
      const corpo = "﻿" + secoes.map(x => (secoes.length > 1 ? `${x.nome}\r\n` : "") + csvLinhas(x)).join("\r\n\r\n");
      return new Response(corpo, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}.csv"`, "Cache-Control": "no-store" } });
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "Coffee & Beats";
    for (const x of secoes) {
      const ws = wb.addWorksheet(x.nome.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
      ws.addRow(x.colunas).font = { bold: true };
      for (const l of x.linhas) ws.addRow(l);
      ws.columns.forEach((c, i) => { c.width = Math.min(60, Math.max(12, ...[x.colunas[i], ...x.linhas.slice(0, 200).map(l => l[i])].map(v => String(v ?? "").length + 2))); });
      ws.views = [{ state: "frozen", ySplit: 1 }];
    }
    const buf = await wb.xlsx.writeBuffer();
    return new Response(buf as ArrayBuffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${nome}.xlsx"`, "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[Relatórios exportar]", e);
    return NextResponse.json({ ok: false, error: "Não foi possível exportar" }, { status: 500 });
  }
}
