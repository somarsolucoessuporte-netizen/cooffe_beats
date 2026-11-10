import { timingSafeEqual } from "node:crypto";
import { recuperarDivisoes } from "@/lib/dividir-conta/runtime";
import { respostaDivisao, tratar } from "@/lib/dividir-conta/http";

export const maxDuration = 60;

// No scheduler/deployment is configured by this change. Provision in staging first.
// Creation flag is intentionally irrelevant to already-started payment recovery.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return new Response(null, { status: 404 });
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return new Response(null, { status: 401 });
  return tratar(async () => { await recuperarDivisoes(); return respostaDivisao({ recuperado: true }); });
}
