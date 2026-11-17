// Pix estático (BR Code / EMV) pela chave CNPJ — sem nenhuma API externa.
// Puro: roda no navegador e no servidor. Manual de Padrões para Iniciação do Pix (Banco Central).

export const PIX_CHAVE_CNPJ = "45433748000116";
export const PIX_RECEBEDOR  = "ARENA 085";
export const PIX_CIDADE     = "FORTALEZA";
export const PIX_COMPROVANTE = "Pix chave CNPJ - confirmação manual";

/** CRC16-CCITT (poly 0x1021, init 0xFFFF) — o CRC do BR Code. */
export function crc16(texto: string): string {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function campo(id: string, valor: string): string {
  if (valor.length > 99) throw new Error(`Campo Pix ${id} longo demais`);
  return id + String(valor.length).padStart(2, "0") + valor;
}

/** Sem acento, só ASCII imprimível, em maiúsculas, com limite de tamanho. */
function textoAscii(valor: string, max: number): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "").toUpperCase().slice(0, max).trim();
}

/** txid: só letras e números, até 25 caracteres; "***" quando não há referência. */
export function txidPix(referencia?: string): string {
  const limpo = (referencia ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25);
  return limpo || "***";
}

export function gerarPixEstatico(params: {
  valor:       number;        // em reais
  referencia?: string;
  chave?:      string;
  nome?:       string;
  cidade?:     string;
  /** Mantém nome/cidade exatamente como informados (só para validar o exemplo do manual). */
  literal?:    boolean;
}): string {
  const centavos = Math.round(params.valor * 100);
  if (!Number.isFinite(centavos) || centavos <= 0 || centavos > 9_999_999_999) throw new Error("Valor Pix inválido");
  const chave  = params.chave ?? PIX_CHAVE_CNPJ;
  const nome   = params.literal ? (params.nome ?? PIX_RECEBEDOR).slice(0, 25) : textoAscii(params.nome ?? PIX_RECEBEDOR, 25);
  const cidade = params.literal ? (params.cidade ?? PIX_CIDADE).slice(0, 15) : textoAscii(params.cidade ?? PIX_CIDADE, 15);

  const semCrc =
    campo("00", "01") +
    campo("01", "11") + // 11 = QR estático
    campo("26", campo("00", "BR.GOV.BCB.PIX") + campo("01", chave)) +
    campo("52", "0000") +
    campo("53", "986") +
    campo("54", (centavos / 100).toFixed(2)) +
    campo("58", "BR") +
    campo("59", nome) +
    campo("60", cidade) +
    campo("62", campo("05", txidPix(params.referencia))) +
    "6304";
  return semCrc + crc16(semCrc);
}

/** O código confere? (CRC dos últimos 4 caracteres bate com o restante.) */
export function crcConfere(payload: string): boolean {
  return /6304[0-9A-F]{4}$/.test(payload) && crc16(payload.slice(0, -4)) === payload.slice(-4);
}

/**
 * Reserva automática: com o QR dinâmico do Mercado Pago ativo, o estático só aparece se o dinâmico
 * falhar ou demorar mais de 10 s. Enquanto o dinâmico não está ativo (ativo=false), o estático
 * é sempre exibido.
 */
export function pixEstaticoVisivel(dinamico: { ativo: boolean; estado: "gerando" | "pronto" | "erro"; decorridoMs: number }): boolean {
  if (!dinamico.ativo) return true;
  if (dinamico.estado === "erro") return true;
  return dinamico.estado === "gerando" && dinamico.decorridoMs > 10_000;
}
