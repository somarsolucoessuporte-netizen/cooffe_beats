import { NextResponse } from "next/server";
import { getSumupToken } from "@/lib/sumup";

export async function GET() {
  try {
    const token = await getSumupToken();
    return NextResponse.json({
      ok:            true,
      message:       "SumUp conectado!",
      token_preview: token.substring(0, 20) + "...",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
