import { prisma } from "@/lib/prisma";
import type { Database, Sql } from "./domain";

// All identifiers are static; values are always bound parameters.
export const db: Database = {
  query: (text, values = []) => prisma.$queryRawUnsafe(text, ...values),
  transaction: fn => prisma.$transaction(tx => fn({
    query: (text, values = []) => tx.$queryRawUnsafe(text, ...values),
  }), { timeout: 15000 }),
};

export async function estruturaPronta(sql: Sql = db) {
  const [r] = await sql.query<{ pronta: boolean }>(`SELECT to_regclass('public."DivisaoControle"') IS NOT NULL AS pronta`);
  return r.pronta;
}

export function habilitada() { return process.env.DIVIDIR_CONTA_ENABLED === "true"; }
