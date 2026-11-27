-- Aditiva: nova categoria de pagamento. Em arquivo próprio: o valor precisa estar gravado antes de ser usado.
ALTER TYPE "MetodoPagamento" ADD VALUE IF NOT EXISTS 'CARTAO_PREPAGO' AFTER 'CARTAO_DEBITO';
