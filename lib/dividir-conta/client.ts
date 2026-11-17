import { DIVISAO_STORAGE } from "./domain";

type AtendimentoStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// This exact test sale was identified and its isolation authorized by the owner.
// Never detach another pending sale automatically.
export const DIVISAO_TESTE_ISOLADA = "dab800a4-4d7c-47fc-afc7-28c2cd4cc21d";

// Detach this sale only. The server ledger remains the source of truth and
// staff can rotate its capability through the existing recovery flow.
export function encerrarAtendimentoDivisao(storage: AtendimentoStorage, arquivo?: AtendimentoStorage) {
  const saved = storage.getItem(DIVISAO_STORAGE);
  if (saved) {
    let id = "criacao";
    try { id = JSON.parse(saved).id || id; } catch { /* retain the original snapshot */ }
    const key = `${DIVISAO_STORAGE}_atendimento_${id}`;
    storage.setItem(key, saved);
    try { arquivo?.setItem(key, saved); } catch { /* staff recovery is also persisted in the database */ }
  }
  storage.removeItem(DIVISAO_STORAGE);
}

export class RequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

// A conflict can be another request or another order on the same terminal.
// Consult authoritative state once; never repeat the charge POST here.
export async function cobrarComReconsulta<T>(cobrar: () => Promise<T>, consultar: () => Promise<T>) {
  try {
    return { conta: await cobrar(), conflito: false };
  } catch (error) {
    if (!(error instanceof RequestError) || error.status !== 409) throw error;
    return { conta: await consultar(), conflito: true };
  }
}
