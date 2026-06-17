import { NextRequest, NextResponse } from "next/server";
import { verificarCheckout } from "@/lib/sumup";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const resultado = await verificarCheckout(id);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao verificar status";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
