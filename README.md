# Coffee & Beats — Sistema de Autoatendimento (Totem)

PWA de autoatendimento para cafeteria, com totem touchscreen, painel operacional e KDS para barista.

## Stack

- **Frontend/Backend**: Next.js 16 (App Router) + TypeScript
- **Banco de dados**: PostgreSQL + Prisma ORM
- **Tempo real**: Socket.IO (servidor standalone)
- **Autenticação**: NextAuth v4
- **Estilização**: Tailwind CSS v4
- **PWA**: next-pwa

## Pré-requisitos

- Node.js 20.x
- PostgreSQL 15+ (local ou Docker)
- Docker (opcional, para Redis)

## Setup Local

### 1. Instalar dependências
```bash
npm install
```

### 2. Banco de dados

**Opção A — PostgreSQL local (recomendado para dev):**
```bash
psql -U postgres -c "CREATE DATABASE coffee_beats;"
psql -U postgres -c "CREATE USER cb_user WITH PASSWORD 'cb_senha_dev';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE coffee_beats TO cb_user;"
psql -U postgres -c "ALTER USER cb_user CREATEDB;"
psql -U postgres -d coffee_beats -c "GRANT ALL ON SCHEMA public TO cb_user;"
```

**Opção B — Docker:**
```bash
docker compose up -d postgres redis
```

### 3. Configurar variáveis de ambiente
```bash
cp .env.example .env
# Edite o .env conforme necessário
```

### 4. Migrations e Seed
```bash
npm run db:migrate
npm run db:seed
```

O seed exibirá o `NEXT_PUBLIC_EMPRESA_ID` — adicione-o no `.env`.

### 5. Iniciar
```bash
npm run dev
```

Acesse:
- **Totem**: http://localhost:3000
- **Painel**: http://localhost:3000/painel/login

**Credenciais de acesso:**
- Admin: `admin@coffeeandbeats.com` / `admin123`
- Barista: `barista@coffeeandbeats.com` / `barista123`

---

## Estrutura de Rotas

```
/ (Tela inicial do totem)
/cardapio
/produto/[id]
/carrinho
/pagamento
/confirmacao

/painel/login
/painel/pedidos  ← Kanban em tempo real
/painel/kds      ← Tela do barista
/painel/dashboard
```

---

## Ativar Modo Quiosque

### Chrome/Chromium (Windows)
```bash
chrome.exe --kiosk --no-first-run --disable-infobars http://localhost:3000
```

### Android — Fully Kiosk Browser
1. Instalar Fully Kiosk Browser
2. Configurar URL: `http://[IP_DO_SERVIDOR]:3000`
3. Ativar kiosk mode nas configurações

### Script systemd (Linux)
```ini
[Unit]
Description=Coffee & Beats Totem
After=network.target

[Service]
WorkingDirectory=/opt/coffee-beats
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

---

## Deploy em VPS

```bash
npm run build
NODE_ENV=production node server.js
```

---

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | URL do PostgreSQL |
| `NEXTAUTH_SECRET` | Segredo JWT (troque em produção) |
| `NEXTAUTH_URL` | URL base da aplicação |
| `NEXT_PUBLIC_SOCKET_URL` | URL do servidor Socket.IO |
| `NEXT_PUBLIC_EMPRESA_ID` | ID da empresa (gerado pelo seed) |
| `NEXT_PUBLIC_PAGAMENTO_SIMULADO` | `true` ativa botão de pagamento simulado |

---

## Resolução de Problemas

**Prisma: shadow database sem permissão**
```sql
ALTER USER cb_user CREATEDB;
```

**NODE_TLS_REJECT_UNAUTHORIZED**
Necessário apenas em dev se houver problemas de certificado local.
Não use em produção.
