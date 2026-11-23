import { COLUNAS_CHAMADO, q, type ChamadoLinha, type SessaoChamados } from "@/lib/chamados";

export type { SessaoChamados };

/** Só devolve o chamado se o usuário puder vê-lo: Somar vê todos; cliente só os da própria loja (operador, só os que abriu). */
export async function buscarChamado(id: string, s: SessaoChamados) {
  const [c] = await q<ChamadoLinha>(`SELECT ${COLUNAS_CHAMADO} FROM "Chamado" c JOIN "Empresa" e ON e.id = c."empresaId" WHERE c.id = $1`, [id]);
  if (!c) return null;
  if (!s.somar && (c.empresaId !== s.empresaId || (!s.gestor && c.usuarioId !== s.usuarioId))) return null;
  return c;
}
