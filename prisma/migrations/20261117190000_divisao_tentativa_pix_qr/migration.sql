-- Parcela paga por Pix QR na tela: guarda o código copia-e-cola da order (o id da order fica em intentId, deviceId='PIX_QR')
ALTER TABLE "TentativaParcela" ADD COLUMN IF NOT EXISTS "qrData" TEXT;
