-- SOMENTE CONSULTA. NÃO É MIGRATION. Não executado em produção.
-- Usar manualmente apenas com autorização, primeiro em homologação.
BEGIN TRANSACTION READ ONLY;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '5s';
SELECT current_database() AS database_name, current_user AS execution_role,
       current_setting('search_path') AS search_path;

-- O SQL Editor pode usar outra role. Owner/RLS sem ler dados financeiros.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       pg_catalog.pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
  AND c.relname IN ('Empresa','Pedido','Pagamento','caixas','_prisma_migrations',
    'ContaDividida','ParcelaConta','TentativaParcela','EventoParcela',
    'DivisaoControle','DivisaoOperacaoLegada')
ORDER BY c.relname;

-- Nomes iguais interrompem CREATE. Outros BEFORE triggers podem interagir por
-- ordem alfabética. Não remover ou substituir automaticamente.
SELECT n.nspname AS schema_name, c.relname AS table_name, t.tgname AS trigger_name,
       t.tgenabled, pg_catalog.pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('Pedido','Pagamento','caixas')
  AND NOT t.tgisinternal
ORDER BY c.relname,t.tgname;

-- Grants de tabela não comprovam visibilidade sob RLS.
SELECT name AS table_name,
       pg_catalog.has_table_privilege(current_user,
         pg_catalog.to_regclass(format('public.%I',name)), 'SELECT') AS can_select,
       pg_catalog.has_table_privilege(current_user,
         pg_catalog.to_regclass(format('public.%I',name)), 'INSERT') AS can_insert,
       pg_catalog.has_table_privilege(current_user,
         pg_catalog.to_regclass(format('public.%I',name)), 'UPDATE') AS can_update
FROM (VALUES ('ContaDividida'),('ParcelaConta'),('TentativaParcela'),
  ('EventoParcela'),('DivisaoControle'),('DivisaoOperacaoLegada')) AS tables(name);

-- Sem textos de queries, URLs ou dados financeiros.
SELECT pid, application_name, state, wait_event_type, wait_event,
       xact_start, pg_catalog.pg_blocking_pids(pid) AS blocking_pids
FROM pg_catalog.pg_stat_activity
WHERE datname = current_database() AND pid <> pg_catalog.pg_backend_pid()
  AND xact_start IS NOT NULL
ORDER BY xact_start LIMIT 30;
ROLLBACK;
