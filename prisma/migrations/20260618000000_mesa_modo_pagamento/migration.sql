-- AlterEnum: add new values to StatusPedido (idempotent for Vercel deploy)
ALTER TYPE "StatusPedido" ADD VALUE IF NOT EXISTS 'COMANDA_ABERTA';
ALTER TYPE "StatusPedido" ADD VALUE IF NOT EXISTS 'AGUARDANDO_PAGAMENTO';

-- AlterTable: add modoPagamento to mesas (idempotent)
ALTER TABLE "mesas" ADD COLUMN IF NOT EXISTS "modoPagamento" TEXT NOT NULL DEFAULT 'hora';
