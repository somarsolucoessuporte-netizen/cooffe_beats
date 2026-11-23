-- Perfil da equipe de suporte da Somar (só acrescenta um valor ao enum)
ALTER TYPE "Perfil" ADD VALUE IF NOT EXISTS 'SOMAR';

CREATE TABLE IF NOT EXISTS "Chamado" (
  id TEXT PRIMARY KEY,
  numero SERIAL NOT NULL,
  "empresaId" TEXT NOT NULL REFERENCES "Empresa"(id),
  "usuarioId" TEXT,
  "usuarioNome" TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  motivo TEXT NOT NULL,
  prioridade TEXT NOT NULL DEFAULT 'MEDIA' CHECK (prioridade IN ('BAIXA','MEDIA','ALTA','URGENTE')),
  status TEXT NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO','EM_ATENDIMENTO','AGUARDANDO_CLIENTE','RESOLVIDO','FECHADO')),
  "abertoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "primeiraRespostaEm" TIMESTAMP(3),
  "resolvidoEm" TIMESTAMP(3),
  "fechadoEm" TIMESTAMP(3),
  "reaberturas" INTEGER NOT NULL DEFAULT 0,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Chamado_numero_key" ON "Chamado"(numero);
CREATE INDEX IF NOT EXISTS "Chamado_empresa_idx" ON "Chamado"("empresaId", "abertoEm");
CREATE INDEX IF NOT EXISTS "Chamado_status_idx" ON "Chamado"(status, prioridade);

CREATE TABLE IF NOT EXISTS "ChamadoEvento" (
  id TEXT PRIMARY KEY,
  "chamadoId" TEXT NOT NULL REFERENCES "Chamado"(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('ABERTURA','MENSAGEM','STATUS','PRIORIDADE','REABERTURA')),
  "autorTipo" TEXT NOT NULL CHECK ("autorTipo" IN ('CLIENTE','SOMAR')),
  "autorId" TEXT,
  "autorNome" TEXT NOT NULL,
  mensagem TEXT,
  "valorAnterior" TEXT,
  "valorNovo" TEXT,
  "anexoNome" TEXT,
  "anexoDados" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ChamadoEvento_chamado_idx" ON "ChamadoEvento"("chamadoId", "criadoEm");
