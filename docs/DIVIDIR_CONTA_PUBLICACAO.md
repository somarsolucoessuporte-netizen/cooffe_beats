# Revisão local e preparação de publicação

## Limites desta entrega

Branch exclusiva `feat/dividir-conta-local`. Sem push, deploy, alteração de variável,
credencial, acesso ao Supabase/maquininha de produção ou execução de ferramenta de
migration. SumUp não é usada na operação atual: permanece só por compatibilidade
histórica. Mercado Pago é o provedor a homologar para a funcionalidade nova.

Os testes usam PostgreSQL PGlite em memória; SQL é exercitado somente como fixture
desse banco descartável, não em banco externo/persistente. O runner não carrega `.env`
e passa apenas variáveis básicas do sistema ao processo filho. Handlers HTTP reais
são compilados em VM com allowlist de dependências simuladas. Não iniciar Next
dev/build com `.env.local` real para homologar.

## Resultados locais desta revisão

- 49 testes aprovados: os 35 cenários anteriores e 14 regressões dos handlers MP,
  retentativa do SDK, webhooks, flag desligada e compatibilidade histórica SumUp.
- Schema Prisma válido em projeto temporário com URLs fictícias.
- TypeScript sem emissão, ESLint dos módulos novos e revisão do diff sem erros.
- Nenhuma dependência nova foi adicionada nesta revisão.

Esses resultados não são homologação de produção nem de PostgreSQL multiconexão.

## SQL e ordem manual

1. `docs/sql/dividir-conta-preflight.sql`: somente consulta, não é migration.
   Inventário manual de owners/RLS/triggers/permissões/transações, sem dados de
   clientes ou textos de queries. Primeiro em homologação, com autorização.
2. `prisma/migrations/20261110000000_dividir_conta/migration.sql`: única migration
   da funcionalidade, manual, aditiva e transacional. Executar inteira uma vez,
   somente com nova autorização. Não reaplicar migrations antigas, seed/reset.

Não colocar o preflight na pasta de migrations. Em erro/timeout, confirmar rollback
da transação inteira; não continuar por trechos. O SQL não é idempotente.
**Se uma versão anterior desse SQL já foi aplicada em algum ambiente, parar e
planejar alteração incremental; não reaplicar nem registrar checksum da versão nova.**

## Locks e impacto

São criadas seis tabelas, índices/FKs/RLS e três triggers em tabelas existentes.
Não há alteração de colunas/enums antigos, conversão, remoção ou atualização de
dados existentes. Insere somente a linha inicial na tabela nova de controle.
`Pagamento.pedidoId` continua único.

- `CREATE TABLE public."ContaDividida"` com FKs adquire locks nas tabelas referenciadas
  `Pedido` e `Empresa`, mesmo criando uma tabela vazia.
- `CREATE TRIGGER` em `Pagamento`, `Pedido` e `caixas` exige locks incompatíveis com
  escritas. Pode aguardar transações antigas e causar fila de operações.
- Índices são criados somente em tabelas novas, não no histórico de vendas.
- RLS/REVOKE afetam só tabelas novas, mas os triggers as consultam com a role chamadora.

`lock_timeout=3s` limita cada espera, e `statement_timeout=30s` cada comando; não são
limites globais. Locks adquiridos ficam até COMMIT/ROLLBACK. Planejar janela e
monitoramento, sem prometer interrupção zero.

Objetos são explicitamente criados em `public`; funções de trigger têm `search_path`
fixo e tabelas qualificadas. Nenhum trigger anterior é removido/substituído. Nome
coincidente interrompe o script. Outros BEFORE triggers executam em ordem alfabética
e podem modificar NEW: inventariar e testar a combinação.

Testar grants e RLS com a **role real do Prisma**, inclusive dentro dos triggers.
SQL Editor usando owner não comprova acesso do backend. Não abrir permissões públicas
para contornar erros. Funções são SECURITY INVOKER, sem elevação de privilégios.

## Flag desligada

`DIVIDIR_CONTA_ENABLED` ausente ou diferente de `true` bloqueia nova conta/cobrança.
A configuração pública desabilitada não consulta banco/token MP. O componente da
divisão é carregado sob demanda.

Antes do SQL, ausência da estrutura mantém o handler integral. Após o SQL, mesmo
desligado, continuam consultas, triggers e leases. Parcelas iniciadas conservam
saldo/terminal e são conciliadas. Retirar proteções pela flag permitiria cobrança
integral concorrente com parcelas existentes. Há overhead e risco de erro de
permissão/timeout. O gate Point é global neste MVP, não uma fila por terminal.
Leases com resultado desconhecido não expiram automaticamente.

O webhook MP exige formato e correspondência com uma tentativa persistida;
`DC-*` histórico não é desviado só pelo prefixo. URLs, assinatura e retentativa
integral do SDK permanecem. SumUp recebe só smoke tests de compatibilidade de código,
sem contato com o serviço, reativação ou homologação de equipamento.

## Histórico Prisma após SQL manual — somente instruções

Este procedimento escreve metadados no banco e exige autorização futura.
**Nenhum comando de conexão/migration abaixo foi executado.**

1. Fixar a revisão Git do SQL final. Guardar horário/resultado da execução manual
   e SHA-256 do arquivo. Para calcular somente o hash local:

   ```powershell
   Get-FileHash -Algorithm SHA256 -LiteralPath 'prisma/migrations/20261110000000_dividir_conta/migration.sql'
   ```

2. Confirmar execução completa no banco/schema corretos e inspecionar tabelas,
   índices parciais, FKs, RLS, funções e triggers. Schema/diff do Prisma sozinho
   não comprova todos os objetos de SQL personalizado.
3. Em sessão autorizada, conferir `_prisma_migrations`: nome, checksum, `finished_at`,
   `rolled_back_at`, `applied_steps_count`, sem selecionar `logs`. Se o histórico
   não existir, estiver divergente ou houver migration antiga pendente/falha,
   PARAR e planejar baseline/reconciliação específica. Não marcar tudo como aplicado.
4. Usar CLI local Prisma 5.22 e conexão administrativa direta com alvo verificado.
   Fornecer variáveis por mecanismo seguro; não editar credenciais nem mostrar
   connection strings em terminal, relatório ou histórico de comandos.
5. Se a migration ainda não estiver registrada e todos os objetos estiverem corretos,
   o comando futuro, sob autorização, será:

   ```powershell
   .\node_modules\.bin\prisma.cmd migrate resolve --applied 20261110000000_dividir_conta --schema .\prisma\schema.prisma
   ```

   Registra a aplicação em `_prisma_migrations`, sem aplicar o SQL de negócio, mas
   escreve metadados no alvo. Não usar antes do SQL manual, em alvo incerto, para
   esconder aplicação parcial, ou se a migration já estiver aplicada.
6. Conferir a linha e executar `migrate status` com a mesma CLI local, somente na
   sessão autorizada. Resultado limpo não substitui inspeção dos objetos.

Não inserir linhas/checksums manualmente, executar `migrate dev`, `migrate reset`,
`db push`, seed/reset ou `migrate deploy` para alinhar o banco. Não usar `npx` que
possa baixar outra versão. Não editar arquivo após aplicado.

Referência: https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing

## Bloqueios para publicar/ativar com segurança

- Revisão do commit e autorização separada para ações em produção.
- Role Prisma real, grants/RLS e inventário dos triggers existentes.
- PostgreSQL multiconexão: locks, deadlocks e carga. PGlite usa uma conexão.
- Point física em homologação autorizada: envio, tipos, timeout, perda de resposta,
  duplicação/atraso de webhook. Testes locais não homologam provedor/equipamento.
- Sunmi/WebView: armazenamento, retomada, navegação, carregamento sob demanda e impressão.
- Build/fluxo completo isolado, nunca com configurações de produção.
- Recuperação periódica autenticada: cron, frequência, duração e monitoramento.
  Nenhum agendamento/`CRON_SECRET` foi criado ou alterado.
- Suporte para leases, resultados desconhecidos, revisão, estornos/chargebacks.
  Não expirar reservas ou repetir cobrança para conferir o que aconteceu.
- Medição de regressão integral MP com SQL instalado e flag desligada.

Ordem futura: homologação → aprovação → deploy desligado → SQL manual em janela
controlada → histórico Prisma → regressão/monitoramento → autorização de piloto.
Rollback mantém processadores compatíveis e desliga novas operações; não apaga
tabelas/parcelas/triggers nem volta a código que ignora contas em andamento.
