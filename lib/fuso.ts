/**
 * Datas do negócio em America/Sao_Paulo (UTC-3 fixo, sem horário de verão desde 2019).
 * O banco e o servidor trabalham em UTC: todo "dia" passa por aqui.
 */
export const FUSO = "America/Sao_Paulo";

/** Dia civil de Brasília no formato YYYY-MM-DD. */
export const diaSP = (d: Date | string | number = new Date()) => new Date(d).toLocaleDateString("en-CA", { timeZone: FUSO });

export const somaDias = (dia: string, n: number) => diaSP(new Date(`${dia}T12:00:00-03:00`).getTime() + n * 86400000);

/** De 00:00:00.000 do primeiro dia até 23:59:59.999 do último, horário de Brasília. */
export function intervaloDias(inicio: string, fim: string = inicio) {
  const a = new Date(`${inicio}T00:00:00.000-03:00`);
  const b = new Date(`${fim}T23:59:59.999-03:00`);
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || a > b) throw new Error("Período inválido");
  return { inicio: a, fim: b };
}

/** Hora (0-23) em Brasília. */
export const horaSP = (d: Date | string) => Number(new Date(d).toLocaleTimeString("en-GB", { timeZone: FUSO, hour: "2-digit", hourCycle: "h23" }).slice(0, 2));

/** "YYYY-MM-DDTHH:mm" sem fuso é horário de Brasília; texto com fuso (Z ou ±hh:mm) é respeitado. */
export const dataHoraSP = (texto: string) =>
  new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(texto) ? `${texto}-03:00` : texto);

/** Valor para <input type="datetime-local"> em horário de Brasília. */
export const campoDataHoraSP = (d: Date | number) => new Date(d).toLocaleString("sv-SE", { timeZone: FUSO }).slice(0, 16).replace(" ", "T");

/**
 * Último instante de validade. Cupons antigos gravaram só a data (meia-noite UTC):
 * valem até o fim desse dia em Brasília.
 */
export const fimValidade = (d: Date | string) => {
  const iso = new Date(d).toISOString();
  return iso.endsWith("T00:00:00.000Z") ? intervaloDias(iso.slice(0, 10)).fim : new Date(d);
};
