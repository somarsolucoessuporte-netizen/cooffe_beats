# Integração com Plataformas de Delivery

## Status atual

A **estrutura técnica está pronta** — banco de dados, modelo de canal de venda, endpoint interno — mas nenhuma API de delivery externa está conectada.

O endpoint `POST /api/pedidos-externos` recebe pedidos no formato compatível com a estrutura interna do Coffee & Beats e os processa normalmente (salva no banco, dispara impressão via cozinha, broadcasting Supabase). Este endpoint está protegido por autenticação admin e **não está exposto publicamente**.

---

## Arquitetura preparada

### Banco de dados

```sql
-- Tabela canais_venda (já existe no banco)
id         | nome       | tipo              | ativo
-----------|------------|-------------------|-------
canal-totem  | Totem    | interno           | true
canal-mesa   | Mesa     | interno           | true
canal-ifood  | iFood    | delivery_externo  | false
canal-99food | 99Food   | delivery_externo  | false
canal-ubereats| Uber Eats| delivery_externo | false

-- Cada Pedido tem canalVendaId opcional
-- Para identificar a origem de cada pedido
```

### Endpoint preparado

```
POST /api/pedidos-externos
Authorization: Bearer <admin-session>

{
  "canalOrigem": "ifood" | "99food" | "ubereats",
  "pedidoExternoId": "abc123",
  "cliente": { "nome": "João Silva", "telefone": "11999990000" },
  "itens": [
    { "nome": "Cappuccino", "quantidade": 1, "preco": 14.90 }
  ],
  "total": 14.90,
  "enderecoEntrega": { ... }
}
```

---

## O que falta para ativar de verdade

### iFood

1. **CNPJ com CNAE de tecnologia** (6209-1/00 ou similar)
2. **Cadastro como integradora** em [developer.ifood.com.br](https://developer.ifood.com.br)
3. **Processo de homologação:**
   - Solicitação de acesso à API de pedidos
   - Testes no ambiente sandbox do iFood
   - Reunião de validação com o time técnico do iFood
   - Aprovação e emissão de `client_id` + `client_secret` de produção
4. **Ligação do webhook:** apontar `POST /api/pedidos-externos` como receiver do webhook do iFood (com autenticação via HMAC ou token no header)
5. **Mapeamento de produtos:** criar tabela `ProdutoExterno { produtoExternoId, produtoLocalId, canal }` para mapear IDs externos para produtos do cardápio local

### 99Food / Uber Eats

Processo similar: cadastro como parceiro de tecnologia, sandbox, homologação, webhook.

---

## Quando conectar

Quando a homologação for aprovada:

1. Adicionar `IFOOD_CLIENT_ID` e `IFOOD_CLIENT_SECRET` nas variáveis de ambiente (Vercel)
2. Criar `lib/ifood.ts` com OAuth2 + fetch para API do iFood
3. Mudar o endpoint para aceitar requisições sem autenticação admin (mas com validação HMAC do iFood)
4. Ativar o canal: `UPDATE canais_venda SET ativo = true WHERE nome = 'iFood'`

O endpoint já está escrito e funcional — basta conectar a fonte real de pedidos.

---

## Contato

Para iniciar o processo de homologação:
**contato@somar.ia.br** · **Somar Soluções Digitais**
