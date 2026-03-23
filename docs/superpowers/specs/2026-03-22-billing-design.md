# Spec: Fluxo de Conta Paga (Billing)

**Data:** 2026-03-22
**Status:** Aprovado
**Escopo:** Integração Stripe para planos Pro e Scale com cobrança recorrente automática

---

## Visão Geral

Implementar o fluxo completo de upgrade de plano usando Stripe Checkout com redirecionamento. O usuário escolhe um plano na página de preços ou via CTA no dashboard, é redirecionado para o Stripe, paga, e tem o plano ativado imediatamente via webhook.

**Decisões de design:**
- Processador: **Stripe** (suporte internacional, 135+ moedas)
- Modelo: **Stripe Checkout** com redirecionamento (não embedded)
- Cobrança: **recorrente automática** (Stripe Billing / Subscriptions)
- Ativação: **imediata** após confirmação do webhook `checkout.session.completed`
- Modo teste disponível via chaves `sk_test_` e Stripe CLI

---

## Planos

| Plano | Limite mensal | Preço |
|-------|--------------|-------|
| Free | 100 requests | R$0 |
| Pro | 1.000 requests | R$49/mês |
| Scale | 10.000 requests | R$149/mês |
| Enterprise | ilimitado | custom (manual) |

---

## Fluxo Principal

```
[Pricing page / CTA no dashboard]
        ↓
  POST /v1/billing/checkout   (autenticado, body: { plano: "pro" | "scale" })
  backend cria Stripe Checkout Session
        ↓
  Redirect → Stripe Checkout (página hospedada pelo Stripe)
        ↓
  Usuário paga com cartão
        ↓
  Stripe → POST /v1/billing/webhook
  backend valida assinatura → atualiza plano_id + stripe_customer_id no banco
        ↓
  Stripe redireciona → {APP_BASE_URL}/dashboard/?upgrade=sucesso
  dashboard exibe banner "Plano ativado com sucesso!"
```

---

## Componentes

### Backend

**`src/routes/billing.js`** — novo arquivo com dois endpoints:

#### `POST /v1/billing/checkout`

- **Autenticação:** Bearer JWT via Supabase (`getUserFromToken`) — **novo middleware JWT**, diferente do `src/middleware/auth.js` existente que usa API key. O novo middleware resolve o usuário a partir do token e popula `req.usuario` com `{ id, email, plano_id }`.
- **Body:** `{ "plano": "pro" | "scale" }`
- Valida se `plano` é `"pro"` ou `"scale"` → `400` se inválido
- Valida se usuário já tem o plano solicitado → `400`
- Busca `stripe_customer_id` em `usuarios`; se nulo, cria novo cliente no Stripe via `stripe.customers.create` e salva o ID resultante no banco antes de criar a sessão
- Cria Stripe Checkout Session com:
  - `mode: "subscription"`
  - `price_id` do plano (via env `STRIPE_PRICE_PRO` / `STRIPE_PRICE_SCALE`)
  - `success_url`: `${APP_BASE_URL}/dashboard/?upgrade=sucesso` (URL absoluta via env)
  - `cancel_url`: `${APP_BASE_URL}/dashboard/pricing.html` (URL absoluta via env)
  - `metadata`: `{ usuario_id: req.usuario.id, plano: "pro" | "scale" }` — o `plano` é armazenado aqui para evitar lookup de `line_items` no webhook
- Retorna `{ url: "<stripe_checkout_url>" }`

#### `POST /v1/billing/webhook`

- **Sem autenticação JWT** — validado exclusivamente pela assinatura Stripe (`STRIPE_WEBHOOK_SECRET`)
- Body recebido como **raw buffer** (não parseado como JSON — obrigatório para validação de assinatura)
- Retorna `400` para assinatura inválida
- Para eventos reconhecidos: retorna `200` em caso de sucesso, `500` em caso de falha de banco (para que o Stripe retente a entrega)

**Eventos tratados:**

| Evento | Ação |
|--------|------|
| `checkout.session.completed` | Obtém `usuario_id` via `session.metadata.usuario_id` e `plano_id` via `session.metadata.plano`. Obtém `stripe_customer_id` via `session.customer` (campo nativo do evento). Atualiza `plano_id` e `stripe_customer_id` em `usuarios`. |
| `customer.subscription.deleted` | Obtém `stripe_customer_id` via `subscription.customer`. Busca usuário por `stripe_customer_id` no banco. Se não encontrado (ex: replay antes do `checkout.session.completed` escrever o ID), loga e retorna `200`. Caso contrário, atualiza `plano_id = 'free'`. |
| `invoice.payment_failed` | Apenas loga. Nota: se o Stripe esgotar as retentativas de cobrança, ele dispara `customer.subscription.deleted` automaticamente, que será tratado pelo handler acima. |

### Banco de dados

**Migração em `usuarios`:**
```sql
ALTER TABLE public.usuarios
  ADD COLUMN stripe_customer_id text UNIQUE;
```

O constraint `UNIQUE` garante que dois usuários não sejam vinculados ao mesmo cliente Stripe, evitando corrupção silenciosa de billing.

### Frontend

**`public/dashboard/pricing.html`** — página pública:
- Exibe cards dos 3 planos (Free, Pro, Scale) com preço, limite e botão
- Free: botão "Criar conta grátis" → `/dashboard/signup.html`
- Pro/Scale: botão "Assinar" → chama `POST /v1/billing/checkout` (se autenticado) ou redireciona para signup (se não autenticado)
- Acessível sem login

**`public/dashboard/index.html`** — atualização:
- Banner de uso: "X de Y requests usados este mês"
- Quando uso ≥ 80%: banner amarelo com link "Fazer upgrade"
- Quando uso = 100%: banner vermelho com link "Fazer upgrade"
- Ao carregar com `?upgrade=sucesso`: exibir banner verde "Plano ativado com sucesso!"

### Configuração

**Variáveis de ambiente (`.env`):**
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_SCALE=price_...
APP_BASE_URL=http://localhost:3000
```

> `APP_BASE_URL` é usado para montar as URLs absolutas de `success_url` e `cancel_url` exigidas pelo Stripe.

**Setup no Stripe Dashboard (modo teste):**
1. Criar produto "DevInsight Pro" com preço recorrente R$49/mês
2. Criar produto "DevInsight Scale" com preço recorrente R$149/mês
3. Copiar os `price_id` para as variáveis de ambiente

---

## Tratamento de Erros

| Situação | Resposta |
|----------|----------|
| Usuário já tem o plano solicitado | `400 { erro: "Você já possui este plano" }` |
| Plano inválido no body | `400 { erro: "Plano inválido" }` |
| Token ausente ou inválido em `/checkout` | `401` |
| Stripe indisponível | `502 { erro: "Erro ao processar pagamento. Tente novamente." }` |
| Webhook com assinatura inválida | `400` |
| `usuario_id` do webhook não encontrado no banco | loga erro, retorna `200` (evita reentrega infinita) |
| Falha ao atualizar banco no webhook | loga erro, retorna `500` (Stripe retentará) |
| Usuário fecha Stripe sem pagar | redireciona para `/dashboard/pricing.html` sem mensagem |

---

## Testes

### Cartões de teste Stripe
| Cartão | Comportamento |
|--------|--------------|
| `4242 4242 4242 4242` | Pagamento aprovado |
| `4000 0000 0000 0002` | Cartão recusado |
| `4000 0025 0000 3155` | Requer autenticação 3DS |

### Webhook local
```bash
stripe listen --forward-to localhost:3000/v1/billing/webhook
```

### Cenários manuais
1. Pagamento bem-sucedido → `plano_id` e `stripe_customer_id` atualizados no banco
2. Pagamento recusado → plano não muda
3. Fechar Stripe sem pagar → volta para pricing sem alteração
4. Webhook com assinatura inválida → rejeitado com `400`
5. Stripe dispara `customer.subscription.deleted` após falhas de cobrança → `plano_id` volta para `'free'`

### Testes automatizados
- `POST /v1/billing/checkout` com JWT válido → retorna `{ url }`
- `POST /v1/billing/checkout` sem JWT → `401`
- `POST /v1/billing/checkout` com plano já ativo → `400`
- `POST /v1/billing/checkout` com plano inválido → `400`
- `POST /v1/billing/webhook` com assinatura inválida → `400`
- `POST /v1/billing/webhook` com evento `checkout.session.completed` válido → plano atualizado no banco

---

## Fora do Escopo (versão inicial)

- Créditos proporcionais em upgrades no meio do ciclo
- Tela de gerenciamento de assinatura (cancelar, trocar plano via portal Stripe) — downgrade ocorre no fim do ciclo já pago (Opção B); cliente mantém o plano atual até o vencimento
- Notificação por email em falha de pagamento
- Plano Enterprise (ativação manual)
- Notas fiscais
- Armazenamento de `stripe_subscription_id` — necessário futuramente para cancelamentos programáticos; exigirá migração de banco quando implementado
