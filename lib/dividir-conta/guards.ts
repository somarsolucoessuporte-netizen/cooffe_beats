import { db, estruturaPronta } from "./database";
import { criarGuardas } from "./legacy";

// No external I/O is performed inside the locking transaction.
export const { protegerPedido, executarLegado, referenciaDividida } = criarGuardas(db, estruturaPronta);
