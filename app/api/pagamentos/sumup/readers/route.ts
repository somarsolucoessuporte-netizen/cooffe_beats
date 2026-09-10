import { NextResponse } from "next/server";
import { getReaders } from "@/lib/sumup";

// Rota de diagnóstico: lista maquininhas registradas no merchant SumUp
export async function GET() {
  try {
    const readers = await getReaders();
    return NextResponse.json({ ok: true, readers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao buscar maquininhas";
    console.error("[SumUp readers]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
