import { NextRequest, NextResponse } from "next/server";
import { verificarCheckout, verificarReaderCheckout } from "@/lib/sumup";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id }   = await params;
  const readerId = req.nextUrl.searchParams.get("readerId");

  try {
    // Pagamento via maquininha: usa endpoint específico do terminal
    if (readerId) {
      try {
        const resultado = await verificarReaderCheckout(readerId, id);
        return NextResponse.json({ ok: true, ...resultado });
      } catch {
        // Endpoint do terminal falhou; tenta o genérico de checkout
        console.warn("[SumUp status] reader endpoint falhou, tentando checkout genérico");
      }
    }

    const resultado = await verificarCheckout(id);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao verificar status";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
