import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";

export const MOTIVOS = [
  "Pagamento no cartão/maquininha",
  "Pix",
  "Dividir conta",
  "Fechamento de caixa",
  "Impressão/comanda",
  "Totem",
  "Site, reservas ou pedido online",
  "Cardápio/produtos",
  "Lentidão ou sistema fora do ar",
  "Dúvida de uso",
  "Sugestão de melhoria",
  "Outro",
] as const;

export const PRIORIDADES = ["BAIXA", "MEDIA", "ALTA", "URGENTE"] as const;
export const STATUS = ["ABERTO", "EM_ATENDIMENTO", "AGUARDANDO_CLIENTE", "RESOLVIDO", "FECHADO"] as const;
export type Prioridade = typeof PRIORIDADES[number];
export type StatusChamado = typeof STATUS[number];

/** Anexo (print) guardado como data URL; limite de ~2 MB de imagem. */
export const ANEXO_MAX_CHARS = 2_900_000;

export type SessaoChamados = {
  usuarioId: string; nome: string; empresaId: string; perfil: string; somar: boolean; gestor: boolean;
};

export async function sessaoChamados(): Promise<SessaoChamados | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user as { name?: string; usuarioId?: string; empresaId?: string; perfil?: string } | undefined;
  if (!u?.usuarioId || !u.empresaId || !u.perfil) return null;
  return {
    usuarioId: u.usuarioId, nome: u.name ?? "Usuário", empresaId: u.empresaId, perfil: u.perfil,
    somar: u.perfil === "SOMAR", gestor: u.perfil === "ADMIN" || u.perfil === "GERENTE",
  };
}

export type ChamadoLinha = {
  id: string; numero: number; empresaId: string; empresaNome?: string; usuarioId: string | null; usuarioNome: string;
  titulo: string; descricao: string; motivo: string; prioridade: Prioridade; status: StatusChamado;
  abertoEm: Date; primeiraRespostaEm: Date | null; resolvidoEm: Date | null; fechadoEm: Date | null;
  reaberturas: number; atualizadoEm: Date;
};

export const COLUNAS_CHAMADO = `c.id, c.numero, c."empresaId", e.nome AS "empresaNome", c."usuarioId", c."usuarioNome", c.titulo, c.descricao, c.motivo,
  c.prioridade, c.status, c."abertoEm", c."primeiraRespostaEm", c."resolvidoEm", c."fechadoEm", c.reaberturas, c."atualizadoEm"`;

export async function q<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return prisma.$queryRawUnsafe<T[]>(sql, ...params);
}

/** Avisa as telas abertas (cliente e Somar) para atualizar na hora. Nunca lança nem trava a resposta. */
export async function avisarChamado(empresaId: string, chamadoId: string, evento: string) {
  try {
    const envio = Promise.all([
      supabaseAdmin.channel(`chamados-empresa-${empresaId}`).send({ type: "broadcast", event: evento, payload: { chamadoId } }),
      supabaseAdmin.channel("chamados-somar").send({ type: "broadcast", event: evento, payload: { chamadoId, empresaId } }),
    ]);
    await Promise.race([envio, new Promise(r => setTimeout(r, 2500))]);
  } catch { /* tempo real é opcional: a tela também atualiza a cada 10 s */ }
}

export async function evento(
  chamadoId: string,
  e: { tipo: "ABERTURA" | "MENSAGEM" | "STATUS" | "PRIORIDADE" | "REABERTURA"; sessao: SessaoChamados; mensagem?: string | null; de?: string | null; para?: string | null; anexoNome?: string | null; anexoDados?: string | null },
) {
  await q(
    `INSERT INTO "ChamadoEvento" (id,"chamadoId",tipo,"autorTipo","autorId","autorNome",mensagem,"valorAnterior","valorNovo","anexoNome","anexoDados")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [randomUUID(), chamadoId, e.tipo, e.sessao.somar ? "SOMAR" : "CLIENTE", e.sessao.usuarioId, e.sessao.nome,
      e.mensagem ?? null, e.de ?? null, e.para ?? null, e.anexoNome ?? null, e.anexoDados ?? null],
  );
}

export function anexoValido(dados?: string | null) {
  if (!dados) return true;
  return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(dados) && dados.length <= ANEXO_MAX_CHARS;
}
