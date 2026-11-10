import { getAdminSession } from "@/lib/admin-auth";
import { db, estruturaPronta } from "@/lib/dividir-conta/database";
import { respostaDivisao, tratar } from "@/lib/dividir-conta/http";

// Read-only operator recovery view. Never return capability hashes or secrets.
export async function GET() {
  const { erro, empresaId } = await getAdminSession(["ADMIN", "GERENTE"]);
  if (erro) return erro;
  return tratar(async () => {
    if (!await estruturaPronta()) return respostaDivisao({ contas: [], operacoesLegadasPendentes: 0 });
    const contas = await db.query(`SELECT c.id,c."pedidoId",c.total,c.status,c."criadoEm",p.senha,
      COALESCE(SUM(t.valor) FILTER (WHERE t.status='APROVADO'),0)::integer AS pago
      FROM "ContaDividida" c JOIN "Pedido" p ON p.id=c."pedidoId"
      LEFT JOIN "TentativaParcela" t ON t."contaId"=c.id
      WHERE c."empresaId"=$1 GROUP BY c.id,p.senha ORDER BY c."criadoEm" DESC LIMIT 100`, [empresaId]);
    // These leases are deliberately global while the MVP uses a shared terminal gate.
    const [legadas] = await db.query<{ total: number }>(`SELECT COUNT(*)::integer AS total FROM "DivisaoOperacaoLegada"`);
    return respostaDivisao({ contas, operacoesLegadasPendentes: legadas.total });
  });
}
