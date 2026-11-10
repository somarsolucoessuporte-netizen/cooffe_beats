import { DivisaoError } from "./domain";

export function tokenRequest(req: Request) { return req.headers.get("authorization")?.replace(/^Bearer /, "") ?? ""; }
export function respostaDivisao(data: unknown, status = 200) { return Response.json({ ok: true, data }, { status, headers: { "Cache-Control": "no-store" } }); }
export async function tratar(fn: () => Promise<Response>) {
  try { return await fn(); }
  catch (e) {
    const status = e instanceof DivisaoError ? e.status : 503;
    // Never return raw provider/SQL errors or credentials.
    return Response.json({ ok: false, error: e instanceof DivisaoError ? e.message : "Não foi possível concluir. Consulte o estado da conta antes de tentar novamente." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
