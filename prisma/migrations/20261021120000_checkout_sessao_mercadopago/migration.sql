-- Checkout Pro do Mercado Pago no portal web: provedor da sessão e cupom aplicado
ALTER TABLE "checkout_sessoes" ADD COLUMN IF NOT EXISTS "provedor" TEXT NOT NULL DEFAULT 'SUMUP';
ALTER TABLE "checkout_sessoes" ADD COLUMN IF NOT EXISTS "cupomId" TEXT;
ALTER TABLE "checkout_sessoes" ADD COLUMN IF NOT EXISTS "valorDesconto" DECIMAL(10,2);
