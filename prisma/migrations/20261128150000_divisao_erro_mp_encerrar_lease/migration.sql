-- Aditiva e idempotente.
-- Resposta de erro do Mercado Pago por tentativa de parcela.
ALTER TABLE public."TentativaParcela" ADD COLUMN IF NOT EXISTS "mpStatus" INTEGER;
ALTER TABLE public."TentativaParcela" ADD COLUMN IF NOT EXISTS "mpErro" TEXT;
-- Operação integral encerrada (conferida) sem apagar o registro.
ALTER TABLE public."DivisaoOperacaoLegada" ADD COLUMN IF NOT EXISTS "encerradoEm" TIMESTAMP(3);
