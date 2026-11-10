import { estruturaPronta, habilitada } from "@/lib/dividir-conta/database";

export async function GET() {
  let enabled = false;
  if (habilitada()) {
    try { enabled = !!process.env.MP_ACCESS_TOKEN && await estruturaPronta(); } catch { /* disabled until ready */ }
  }
  return Response.json({ ok: true, enabled }, { headers: { "Cache-Control": "no-store" } });
}
