/**
 * POST /api/pagamentos/mercadopago/webhook
 * URL cadastrada no painel do Mercado Pago. Mesmo handler de /api/pagamentos/mp/webhook
 * (que continua ativo para preferências e intenções Point já criadas com a URL antiga).
 */
export { POST } from "@/app/api/pagamentos/mp/webhook/route";
