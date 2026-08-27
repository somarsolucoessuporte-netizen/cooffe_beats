# Scripts de cardápio

## cardapio-novo.json
Fonte de verdade do cardápio Coffee & Beats (importado em 2026-08-25).
Use como referência para reseeds ou auditorias de preço.

## atualizar-cardapio.ts
Script de importação. Sem flag roda em modo dry-run (padrão); `--apply` grava no banco.

Grava via REST API do Supabase (service_role), não via conexão Postgres direta —
a porta do pooler (5432/6543) fica bloqueada nesta rede.

### Como usar
```bash
# Conferir sem gravar
npx tsx scripts/cardapio/atualizar-cardapio.ts

# Gravar no banco
npx tsx scripts/cardapio/atualizar-cardapio.ts --apply
```
