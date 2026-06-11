import { erroResposta } from "@/lib/api-response";

// Stub para integração futura com Mercado Pago ou EFÍ Bank
export async function POST() {
  return erroResposta("PIX não configurado nesta versão", 501);
}
