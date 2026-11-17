-- Pix QR dinâmico em paralelo à Point: guarda o id da order para cancelar o meio que não foi usado
ALTER TABLE "Pagamento" ADD COLUMN IF NOT EXISTS "pixOrderId" TEXT;
