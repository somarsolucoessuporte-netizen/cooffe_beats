import { NextResponse } from "next/server";
import { listarDispositivosPoint } from "@/lib/mercadopago";

/** GET /api/pagamentos/mp/dispositivos — maquininhas Point vinculadas à conta. */
export async function GET() {
  try {
    const devices = await listarDispositivosPoint();
    return NextResponse.json({ ok: true, data: devices });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao listar dispositivos";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
