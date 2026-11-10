// Pure rules: safe to import in the browser and in isolated tests.
export const DIVISAO_STORAGE = "cb_divisao_em_andamento";
export class DivisaoError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

export function centavos(valor: string | number): number {
  const texto = String(valor).replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) throw new DivisaoError("Valor monetário inválido", 400);
  const [inteiro, decimal = ""] = texto.split(".");
  const n = Number(inteiro) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(n) || n <= 0 || n > 999999999) throw new DivisaoError("Valor fora do limite", 400);
  return n;
}

export function dividirIgualmente(total: number, pessoas: number): number[] {
  if (!Number.isSafeInteger(total) || total < 2 || !Number.isInteger(pessoas) || pessoas < 2 || pessoas > 20 || pessoas > total) {
    throw new DivisaoError("Escolha de 2 a 20 pessoas, com pelo menos um centavo por pessoa", 400);
  }
  return Array.from({ length: pessoas }, (_, i) => Math.floor(total / pessoas) + (i < total % pessoas ? 1 : 0));
}

export function validarParcelas(total: number, valores: number[]) {
  if (valores.length < 2 || valores.length > 20 || valores.some(v => !Number.isSafeInteger(v) || v <= 0) || valores.reduce((s, v) => s + v, 0) !== total) {
    throw new DivisaoError("As parcelas devem ser positivas e somar exatamente o total", 400);
  }
}

export const ATIVOS = ["CRIANDO", "PENDENTE", "DESCONHECIDO"] as const;
export type EstadoTentativa = typeof ATIVOS[number] | "APROVADO" | "RECUSADO" | "REVISAO";
export type Resultado = {
  referencia: string;
  status: "PENDING" | "PAID" | "FAILED" | "REVIEW";
  paymentId?: string;
  intentId?: string;
  valorCentavos?: number;
  moeda?: string;
  metodo?: string;
};

export interface Sql {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<T[]>;
}
export interface Database extends Sql {
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
}
export interface Provedor {
  criar(input: { referencia: string; valorCentavos: number; deviceId: string }): Promise<{ intentId: string }>;
  consultar(input: { referencia: string; intentId: string | null }): Promise<Resultado | null>;
}

export type Conta = { id: string; pedidoId: string; empresaId: string; tokenHash: string; criacaoHash: string; total: number; status: string; fingerprint: string; requestHash: string; notificada: boolean };
export type Parcela = { id: string; contaId: string; ordem: number; valor: number; status: string };
export type Tentativa = { id: string; parcelaId: string; contaId: string; chave: string; referencia: string; deviceId: string; intentId: string | null; paymentId: string | null; status: EstadoTentativa; valor: number; metodo: string | null };
