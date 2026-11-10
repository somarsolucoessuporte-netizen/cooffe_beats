-- ADITIVA. Não executar automaticamente. Revisar e homologar em banco descartável.
-- Não modifica nem converte os pagamentos existentes.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public;

CREATE TABLE public."DivisaoControle" (id INTEGER PRIMARY KEY CHECK (id = 1));
INSERT INTO public."DivisaoControle" (id) VALUES (1);

CREATE TABLE public."ContaDividida" (
  id TEXT PRIMARY KEY,
  "pedidoId" TEXT NOT NULL UNIQUE REFERENCES public."Pedido"(id),
  "empresaId" TEXT NOT NULL REFERENCES public."Empresa"(id),
  "tokenHash" TEXT NOT NULL UNIQUE,
  "criacaoHash" TEXT NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  total INTEGER NOT NULL CHECK (total > 0),
  status TEXT NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA','QUITADA','REVISAO','CANCELADA')),
  notificada BOOLEAN NOT NULL DEFAULT FALSE,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public."ParcelaConta" (
  id TEXT PRIMARY KEY,
  "contaId" TEXT NOT NULL REFERENCES public."ContaDividida"(id),
  ordem INTEGER NOT NULL CHECK (ordem > 0),
  valor INTEGER NOT NULL CHECK (valor > 0),
  status TEXT NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA','APROVADO','REVISAO')),
  UNIQUE ("contaId", ordem)
);
CREATE TABLE public."TentativaParcela" (
  id TEXT PRIMARY KEY,
  "contaId" TEXT NOT NULL REFERENCES public."ContaDividida"(id),
  "parcelaId" TEXT NOT NULL REFERENCES public."ParcelaConta"(id),
  chave TEXT NOT NULL UNIQUE,
  referencia TEXT NOT NULL UNIQUE,
  "deviceId" TEXT NOT NULL,
  "intentId" TEXT UNIQUE,
  "paymentId" TEXT UNIQUE,
  valor INTEGER NOT NULL CHECK (valor > 0),
  metodo TEXT,
  status TEXT NOT NULL CHECK (status IN ('CRIANDO','PENDENTE','DESCONHECIDO','APROVADO','RECUSADO','REVISAO')),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consultadoEm" TIMESTAMP(3),
  "aprovadoEm" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "TentativaParcela_ativa_parcela" ON public."TentativaParcela" ("parcelaId")
  WHERE status IN ('CRIANDO','PENDENTE','DESCONHECIDO');
CREATE UNIQUE INDEX "TentativaParcela_ativa_device" ON public."TentativaParcela" ("deviceId")
  WHERE status IN ('CRIANDO','PENDENTE','DESCONHECIDO');
CREATE UNIQUE INDEX "TentativaParcela_paga_parcela" ON public."TentativaParcela" ("parcelaId") WHERE status='APROVADO';
CREATE INDEX "TentativaParcela_conta" ON public."TentativaParcela" ("contaId");
CREATE TABLE public."EventoParcela" (
  id TEXT PRIMARY KEY,
  "tentativaId" TEXT NOT NULL REFERENCES public."TentativaParcela"(id),
  resultado JSONB NOT NULL,
  processado BOOLEAN NOT NULL DEFAULT FALSE,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Leases não expiram automaticamente: uma operação externa interrompida pode ter cobrado.
-- Só impedem iniciar uma divisão; não modificam os pagamentos integrais entre si.
CREATE TABLE public."DivisaoOperacaoLegada" (
  id TEXT PRIMARY KEY,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ContaDividida_empresa" ON public."ContaDividida" ("empresaId");

-- Backstop: mesmo uma versão antiga da API não pode registrar pagamento integral
-- de um pedido que nasceu dividido. APIs novas também bloqueiam ANTES de chamar o MP.
CREATE FUNCTION public."divisao_proteger_pagamento"() RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."ContaDividida" WHERE "pedidoId" = NEW."pedidoId") THEN
    RAISE EXCEPTION 'Pedido vinculado à divisão de conta' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "divisao_guard_pagamento" BEFORE INSERT OR UPDATE ON public."Pagamento"
  FOR EACH ROW EXECUTE FUNCTION public."divisao_proteger_pagamento"();

CREATE FUNCTION public."divisao_proteger_pedido"() RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
DECLARE c public."ContaDividida";
BEGIN
  SELECT * INTO c FROM public."ContaDividida" WHERE "pedidoId" = NEW.id;
  IF FOUND THEN
    IF c.status = 'CANCELADA' THEN
      IF NEW.status = 'CANCELADO' AND NOT NEW.pago AND NEW.total = OLD.total
        AND NEW."empresaId" = OLD."empresaId" AND NEW."caixaId" IS NOT DISTINCT FROM OLD."caixaId"
        AND NEW."mesaId" IS NOT DISTINCT FROM OLD."mesaId" THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'Divisão cancelada não pode ser reaberta pelo fluxo integral' USING ERRCODE = '23514';
    END IF;
    IF NEW.total IS DISTINCT FROM OLD.total OR NEW."empresaId" IS DISTINCT FROM OLD."empresaId"
      OR NEW."caixaId" IS DISTINCT FROM OLD."caixaId" OR NEW."mesaId" IS DISTINCT FROM OLD."mesaId"
      OR NEW.status = 'CANCELADO' THEN
      RAISE EXCEPTION 'Consumo dividido não pode ser alterado ou cancelado pelo fluxo integral' USING ERRCODE = '23514';
    END IF;
    IF c.status <> 'QUITADA' AND (NEW.pago OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'AGUARDANDO_PAGAMENTO')) THEN
      RAISE EXCEPTION 'Divisão ainda não quitada' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "divisao_guard_pedido" BEFORE UPDATE ON public."Pedido"
  FOR EACH ROW EXECUTE FUNCTION public."divisao_proteger_pedido"();

CREATE FUNCTION public."divisao_proteger_caixa"() RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.status = 'FECHADO' AND EXISTS (
    SELECT 1 FROM public."ContaDividida" c JOIN public."Pedido" p ON p.id = c."pedidoId"
    WHERE p."caixaId" = NEW.id AND c.status NOT IN ('QUITADA','CANCELADA')
  ) THEN
    RAISE EXCEPTION 'Caixa com divisão pendente ou em revisão' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "divisao_guard_caixa" BEFORE UPDATE ON public.caixas
  FOR EACH ROW EXECUTE FUNCTION public."divisao_proteger_caixa"();

-- Somente o backend Prisma (role de conexão privada) acessa estes registros.
ALTER TABLE public."DivisaoControle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ContaDividida" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ParcelaConta" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TentativaParcela" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EventoParcela" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DivisaoOperacaoLegada" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."DivisaoControle", public."ContaDividida", public."ParcelaConta", public."TentativaParcela", public."EventoParcela", public."DivisaoOperacaoLegada" FROM PUBLIC;
-- Revoga roles Supabase quando presentes; compatível com PostgreSQL descartável.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public."DivisaoControle", public."ContaDividida", public."ParcelaConta", public."TentativaParcela", public."EventoParcela", public."DivisaoOperacaoLegada" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public."DivisaoControle", public."ContaDividida", public."ParcelaConta", public."TentativaParcela", public."EventoParcela", public."DivisaoOperacaoLegada" FROM authenticated;
  END IF;
END $$;
COMMIT;
