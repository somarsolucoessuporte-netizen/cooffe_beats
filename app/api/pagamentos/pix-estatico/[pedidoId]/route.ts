import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gerarPixEstatico } from "@/lib/pix-estatico";
import { protegerPedido } from "@/lib/dividir-conta/guards";

/**
 * GET /api/pagamentos/pix-estatico/[pedidoId]?ref=...
 * Pix BR Code estático (chave CNPJ) com o valor do pedido gravado no banco. Sem chamada externa.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ pedidoId: string }> }) {
  const { pedidoId } = await params;
  try {
    const bloqueio = await protegerPedido(pedidoId);
    if (bloqueio) return bloqueio;
    const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, select: { total: true, senha: true, status: true } });
    if (!pedido) return NextResponse.json({ ok: false, error: "Pedido não encontrado" }, { status: 404 });
    if (pedido.status === "CANCELADO") return NextResponse.json({ ok: false, error: "Pedido cancelado" }, { status: 409 });
    const valor = Number(pedido.total);
    const ref   = req.nextUrl.searchParams.get("ref") ?? pedido.senha;
    return NextResponse.json({ ok: true, valor, payload: gerarPixEstatico({ valor, referencia: ref }) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[Pix estático]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "Não foi possível gerar o Pix" }, { status: 500 });
  }
}
