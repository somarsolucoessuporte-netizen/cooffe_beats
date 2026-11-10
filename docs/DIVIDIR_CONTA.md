# Dividir Conta — implementação local e roteiro de homologação

## Estado e limites

Desenvolvido na branch `feat/dividir-conta-local`. A `main` não recebeu commits.
Nenhuma variável de ambiente, credencial, serviço ou banco de produção foi alterado.
Nenhum deploy ou cobrança real foi executado. Não foi iniciado Next dev/build com
o `.env.local`: essas operações podem carregar configurações reais e acessar serviços.

A flag é exclusivamente de servidor: `DIVIDIR_CONTA_ENABLED === "true"`.
Ausência da variável, `false` ou qualquer outro valor desativa novas contas/cobranças.
Não é necessário adicionar variável para manter o recurso desligado.

Este MVP divide **o carrinho/pedido novo da tela /pagamento**. Não agrega comandas
históricas da mesa e não modifica pedidos existentes para convertê-los em divisão.
Permite 2–20 pessoas, distribuição exata de centavos e edição dos valores antes da
confirmação. Após confirmar, valores e consumo ficam congelados. Cada parcela usa
a Point existente; não há checkout parcial SumUp, divisão por itens ou recebimento
manual de parcelas. Os fluxos integrais SumUp e Checkout Pro permanecem existentes.
SumUp não é utilizada na operação atual, conforme informado pelo responsável;
permanece apenas como compatibilidade histórica, sem reativação nesta entrega.

## SQL: caminho e ordem manual

**Único SQL novo:**

`prisma/migrations/20261110000000_dividir_conta/migration.sql`

1. Confirmar que o banco de homologação corresponde ao schema atual do projeto.
2. Executar **somente esse arquivo novo, uma vez**, integralmente, em homologação.
   Não executar novamente as migrations antigas nem o seed/reset.
3. Validar constraints, triggers, RLS e permissões da role usada pelo Prisma.
4. Homologar aplicação com integrações simuladas e depois recursos oficiais de teste.
5. Apenas com autorização futura, publicar código com flag desligada e aplicar o
   mesmo SQL manualmente em produção em janela controlada. Confirmar que todas as
   funções/rotas publicadas já incluem as proteções antes de ativar.
6. Ativar apenas depois de revisão e autorização específicas.

O SQL usa transação e limites de espera. Cria seis tabelas, índices e triggers;
não converte, atualiza ou apaga registros antigos. **DDL ainda exige locks** sobre
as tabelas que recebem triggers: a aplicação manual precisa de janela e acompanhamento.
Se houver timeout/erro, a transação deve ser revertida; não continuar por trechos.
Não é um script idempotente de reaplicação. Não existe migration destrutiva de rollback.

O roteiro detalhado de locks e alinhamento do Prisma está em
`docs/DIVIDIR_CONTA_PUBLICACAO.md`. O preflight somente de consulta fica fora das
migrations, em `docs/sql/dividir-conta-preflight.sql`. Os objetos da migration são
qualificados em `public` e as funções de trigger possuem `search_path` fixo.

Se o SQL for aplicado pelo SQL Editor, o histórico `_prisma_migrations` não será
atualizado automaticamente. Não executar depois `prisma migrate deploy/dev` às
cegas; alinhar o histórico por procedimento revisado antes de futuras migrations.

## Persistência e segurança

- `ContaDividida`: pedido único, empresa, total em centavos, hash da capability,
  fingerprint e estados ABERTA/QUITADA/REVISAO/CANCELADA.
- `ParcelaConta`: valor e ordem de cada parcela.
- `TentativaParcela`: referência externa, chave idempotente, terminal, IDs MP,
  valor, método confirmado e estados financeiros.
- `EventoParcela`: resultado verificado, recepção durável e replay.
- `DivisaoControle`: mutex transacional para reservas e transições financeiras.
- `DivisaoOperacaoLegada`: lease curta de criação integral na Point. Lease
  interrompida permanece até revisão, pois a operação pode ter cobrado.

O registro legado `Pagamento` permanece 1:1 com `Pedido`. Não são criados pagamentos
agregados fictícios. Recebimentos parciais são adicionados aos totais por método
dos relatórios, e o extrato adicional fica no campo `divisao`.
`totalVendas` mantém a semântica existente de vendas, não se transforma em recebido.
O relatório diário adicional usa data da confirmação; pode conter recebimento de
pedido criado em outro dia. Valores em revisão são excluídos dos recebimentos
confirmados e precisam de conciliação humana; não constituem relatório líquido
completo de estornos parciais/chargebacks.

RLS está habilitada sem políticas públicas. `anon`, `authenticated` e PUBLIC não
recebem acesso às tabelas. O backend usa a conexão privada do Prisma; confirmar
em homologação que sua role tem permissões apropriadas. Não criar políticas de
leitura pública para contornar erro de permissões.

A sessão do totem usa token aleatório de 256 bits, somente no `sessionStorage`.
O servidor guarda SHA-256 e exige a capability para consultar/cobrar/cancelar.
O hash da operação de criação permanece imutável mesmo após transferência de sessão;
uma aba antiga não consegue criar outro pedido repetindo a requisição original.
Tokens não vão em URLs, logs ou consultas Supabase do navegador. O servidor
recalcula preços/adicionais com o catálogo e valida empresa/mesa/cliente.

## Idempotência, reserva e efeitos

Pedido, itens, conta e parcelas nascem na mesma transação. Uma requisição repetida
com o mesmo token recupera a conta; dados diferentes com a mesma chave são rejeitados.
Não existe janela em que o pedido seja visível sem o vínculo de divisão.

Antes da chamada à Point, a tentativa já está persistida e o saldo/terminal estão
reservados. Nenhuma transação de banco aguarda rede externa. Há índices únicos
para tentativa ativa por parcela/terminal, pagamento aprovado por parcela,
referência, chave idempotente e payment ID externo.

O POST parcial não tem retentativa automática do SDK. Timeout/erro gera estado
DESCONHECIDO, conserva reserva e não reenvia a cobrança, mesmo com outra chave.
Recusa verificada permite uma tentativa nova. Não há cancelamento automático de
intenção externa. Uma divisão só pode ser desfeita pelo cliente **antes de qualquer
tentativa**, inclusive antes de tentativas recusadas. O cancelamento preserva dados.

Webhooks consultam o MP antes de aplicar valores. Aprovação exige referência,
payment ID, BRL e valor exato. O encaminhamento à divisão exige formato esperado
e correspondência com tentativa persistida: o prefixo `DC-` isoladamente não
identifica a integração, preservando referências históricas.
Eventos/pagamentos repetidos não incrementam saldo.
Eventos conflitantes, aprovações tardias concorrentes e estornos exigem REVISAO,
sem fechar automaticamente. Uma tentativa ainda incerta conserva a reserva; uma
revisão histórica de estorno, sem tentativa ativa, não ocupa a Point.

Somente após total aprovado e ausência de tentativa ativa a conta vira QUITADA.
A transação marca o pedido pago/RECEBIDO, atualiza estatística e baixa estoque uma
vez. Se houver falha nessa transação, o evento fica pendente para replay: não
iniciar nova cobrança. Broadcast ocorre após commit, é repetível e o painel/KDS
já deduplicam por pedido. O novo fluxo não chama o endpoint HTTP legado de baixa.
WhatsApp de confirmação não foi acrescentado ao fluxo novo.

## Proteções do fluxo integral

Os endpoints MP, SumUp, dinheiro, simulação, confirmação manual e cancelamento
verificam o vínculo antes de cobrar/aprovar/cancelar. Alteração de status impede
cancelamento e preparo antecipado de pedido dividido. Triggers são a segunda
barreira, incluindo fechamento de caixa com divisão aberta/em revisão.

Na Point, criação integral registra lease antes de chamar o handler existente.
A reserva parcial consulta a mesma trava, as leases e pagamentos legados pendentes.
Enquanto houver tentativa parcial ativa, outra criação integral Point é recusada
antes da API externa. **O MVP é conservador: exclusão de novas cobranças Point é
global para a aplicação**, não uma fila independente por empresa/terminal. Isso
pode causar espera operacional quando houver múltiplas maquininhas. SumUp não usa
essa trava de terminal MP, mas não pode cobrar um pedido vinculado à divisão.

Antes da migration, as verificações detectam ausência da estrutura e continuam
no handler legado. Depois, há consultas/leases adicionais: medir impacto em
homologação. Não prometer regressão zero. As correções gerais da auditoria de
lentidão/autenticação ficam fora desta entrega.

## Recuperação e operação

- `GET /api/pagamentos/dividir/config`: habilitação calculada no servidor.
- `POST /api/pagamentos/dividir`: cria ou recupera a operação inicial.
- `GET /api/pagamentos/dividir/:id`: consulta e reconcilia, com capability.
- `POST /api/pagamentos/dividir/:id/cobrar`: nova tentativa sob flag.
- `POST /api/pagamentos/dividir/:id/cancelar`: apenas antes de qualquer tentativa.
- `GET /api/admin/contas-divididas`: lista administrativa, sem tokens/hashes.
- `POST /api/admin/contas-divididas/recuperar`: recuperação autenticada ADMIN/GERENTE.
- `/admin/contas-divididas`: tela administrativa de saldos/recuperação.
- `POST /api/admin/contas-divididas/:id/retomar`: ADMIN/GERENTE da mesma empresa
  rotaciona a capability para continuar no aparelho atual; não cria cobrança.
- `GET /api/pagamentos/dividir/recuperar`: recuperação periódica com Bearer
  `CRON_SECRET`; sem essa variável retorna 404. Nenhum cron foi instalado/agendado.

Webhook, polling, replay e recuperação não dependem da flag de criação. Desligar a
flag interrompe novas cobranças, mas não abandona as já iniciadas. Preparar e
validar um agendamento autenticado em homologação **antes da ativação** para não
depender de manter o navegador aberto. O worker processa lotes limitados e alterna
contas pelo momento de consulta; confirmar duração e frequência na hospedagem.

Lease legada interrompida ou tentativa sem intent ID não expira financeiramente.
Busca por referência pode encontrar aprovação; ausência de resultado não prova
que não houve cobrança. Um operador precisa confrontar o painel MP antes de
liberar qualquer situação desconhecida. Não apagar reservas para "destravar".

Fechar a aba pode perder a capability. ADMIN/GERENTE pode retomar em
`/admin/contas-divididas`, no aparelho que continuará o pagamento. Isso invalida a
capability anterior, preserva tentativas e não cobra novamente. Validar o procedimento
de transferência com a equipe antes do piloto em equipamento compartilhado.

## Testes locais e limites da evidência

`npm run test:dividir-conta`

O runner transpila somente módulos explicitamente listados e executa PostgreSQL
PGlite em memória. Não importa Prisma/Next/Supabase nem carrega `.env`. Remove
variáveis sensíveis do ambiente filho. Testes do adaptador SDK usam token inválido
de teste e `fetch` interceptado; nenhuma requisição externa de pagamento é enviada.
As migrations são lidas/executadas **somente nessa instância descartável em memória**.

Inclui cálculos/centavos, autorização, criação concorrente, duplo clique,
idempotência, reserva, exclusão integral/parcial, timeout, eventos duplicados,
evento anterior à resposta, recuperação, falha no estoque durante quitação,
aprovação tardia, moeda/valor incorretos, refund, proteção de fechamento, cancelamento
seguro, regressão do handler legado e proibição de acesso pelas roles públicas.

`node node_modules/typescript/bin/tsc --noEmit --incremental false`

`node scripts/validar-schema-isolado.mjs`

A validação Prisma copia o schema para projeto temporário com URLs fictícias,
sem ler o ambiente da aplicação. Não migra, gera client ou conecta ao banco.

Também executar ESLint nos módulos novos e `git diff --check`. Não usar
`npm run build` ou `next dev` com as configurações de produção para testar.

Resultado local: 49 testes financeiros/adaptador/handlers aprovados, schema Prisma validado em
projeto temporário, TypeScript sem emissão e ESLint dos módulos novos aprovados.
O manifesto abaixo contém todos os arquivos de implementação e validação.

PGlite usa uma conexão e serializa transações. Os testes validam disputas lógicas,
SQL e constraints, mas **não substituem teste multiconexão no PostgreSQL real**.
Faltam homologação de interface/WebView/Sunmi/impressão, API MP/Point com recursos
oficiais de teste, assinatura/formatos de webhook e infraestrutura Vercel/Supabase.

## Ativação e rollback

1. Homologar com banco/conta/terminal de teste isolados e validar pagamento integral.
2. Revisar roles, locks DDL, métricas e procedimentos para estado desconhecido.
3. Preparar recuperação periódica e atendimento de perda de sessão.
4. Publicar sob autorização, com flag desligada; validar todas as rotas protegidas.
5. Aplicar SQL manual revisado e conferir schema. Não misturar instâncias antigas
   sem proteção com divisão ativa. Fazer piloto assistido antes de ampliar.
6. Monitorar tentativas desconhecidas, eventos não processados, leases antigas,
   contas em revisão, atraso na notificação e erros nos pagamentos integrais.

Rollback operacional: desligar novas operações; manter esta versão capaz de
conciliar/processar webhooks; não apagar tabelas/parcelas/leases nem retirar triggers
enquanto houver contas. Não voltar a uma versão que desconhece o módulo com
divisões ativas. Contas parcialmente pagas nunca viram cobrança integral do total.

## Manifesto de arquivos

Novos:

- `components/totem/DividirConta.tsx`
- `lib/dividir-conta/domain.ts`
- `lib/dividir-conta/database.ts`
- `lib/dividir-conta/service.ts`
- `lib/dividir-conta/legacy.ts`
- `lib/dividir-conta/guards.ts`
- `lib/dividir-conta/mercadopago.ts`
- `lib/dividir-conta/runtime.ts`
- `lib/dividir-conta/http.ts`
- `lib/dividir-conta/relatorios.ts`
- `app/api/pagamentos/dividir/route.ts`
- `app/api/pagamentos/dividir/config/route.ts`
- `app/api/pagamentos/dividir/[id]/route.ts`
- `app/api/pagamentos/dividir/[id]/cobrar/route.ts`
- `app/api/pagamentos/dividir/[id]/cancelar/route.ts`
- `app/api/pagamentos/dividir/recuperar/route.ts`
- `app/api/admin/contas-divididas/route.ts`
- `app/api/admin/contas-divididas/recuperar/route.ts`
- `app/api/admin/contas-divididas/[id]/retomar/route.ts`
- `app/(painel)/admin/contas-divididas/page.tsx`
- `prisma/migrations/20261110000000_dividir_conta/migration.sql`
- `tests/dividir-conta/financial.test.ts`
- `tests/dividir-conta/route-harness.ts`
- `scripts/test-dividir-conta.mjs`
- `scripts/validar-schema-isolado.mjs`
- `docs/DIVIDIR_CONTA.md`
- `docs/DIVIDIR_CONTA_PUBLICACAO.md`
- `docs/sql/dividir-conta-preflight.sql` (somente consulta; não é migration)

Modificados:

- `.gitignore` (artefatos isolados de teste)
- `package.json` e `package-lock.json` (runner e PGlite apenas como devDependency)
- `prisma/schema.prisma`
- `app/(totem)/pagamento/page.tsx`
- `app/api/pagamentos/mp/criar/route.ts`
- `app/api/pagamentos/mp/webhook/route.ts`
- `app/api/pagamentos/sumup/criar/route.ts`
- `app/api/pagamentos/confirmar-manual/[pedidoId]/route.ts`
- `app/api/pagamentos/cancelar/[pedidoId]/route.ts`
- `app/api/pagamentos/dinheiro/route.ts`
- `app/api/pagamentos/simular/route.ts`
- `app/api/pagamentos/status/[pedidoId]/route.ts`
- `app/api/pedidos/[id]/status/route.ts`
- `app/api/admin/mesas/[id]/fechar/route.ts`
- `app/api/caixa/status/route.ts`
- `app/api/caixa/fechar/route.ts`
- `app/api/relatorios/dia/route.ts`
- `lib/mercadopago.ts` (opção aditiva de não retentar, usada só na divisão)

A pasta `.claude/` já existia como não rastreada e foi preservada. Os arquivos
`.env`, `.env.local`, configuração Vercel e credenciais não fazem parte da alteração.
