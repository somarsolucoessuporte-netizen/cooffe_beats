import { NextResponse } from "next/server";

export type ApiResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export function resposta<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data } satisfies ApiResponse<T>, { status });
}

export function erroResposta(mensagem: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error: mensagem } satisfies ApiResponse, { status });
}
