export const FUSO = "America/Sao_Paulo";

export const NOME_STATUS: Record<string, string> = {
  ABERTO: "Aberto", EM_ATENDIMENTO: "Em atendimento", AGUARDANDO_CLIENTE: "Aguardando cliente", RESOLVIDO: "Resolvido", FECHADO: "Fechado",
};
export const NOME_PRIORIDADE: Record<string, string> = { BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta", URGENTE: "Urgente — operação parada" };

export function dataHora(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** 2 h 15 min · 3 d 4 h · 45 s */
export function duracao(ms: number | null | undefined) {
  if (ms == null || !isFinite(ms) || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${String(m % 60).padStart(2, "0")} min`;
  const d = Math.floor(h / 24);
  return `${d} d ${h % 24} h`;
}

export const ms = (d: string | Date | null | undefined) => (d ? new Date(d).getTime() : null);
