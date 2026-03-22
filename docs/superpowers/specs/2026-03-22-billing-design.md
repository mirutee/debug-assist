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
  Stripe redireciona → /dashboard/?upgrade=sucesso
  dashboard exibe banner "Plano ativado com sucesso!"
```

---

## Componentes

### Backend

**`src/routes/billing.js`** — novo arquivo com dois endpoints:

#### `POST /v1/billing/checkout`
- Autenticação: Bearer JWT (mesmo middleware de `/v1/auth/me`)
- Body: `{ "plano": "pro" | "scale" }`
- Valida se usuário já tem o plano solicitado → `400`
- Cria ou recupera `stripe_customer_id` para o usuário
- Cria Stripe Checkout Session com:
  - `mode: "subscription"`
  - `price_id` do plano (via env `STRIPE_PRICE_PRO` / `STRIPE_PRICE_SCALE`)
  - `success_url`: `/dashboard/?upgrade=sucesso`
  - `cancel_url`: `/dashboard/pricing.html`
  - `metadata`: `{ usuario_id: <uuid> }`
- Retorna `{ url: "<stripe_checkout_url>" }`

#### `POST /v1/billing/webhook`
- Sem autenticação JWT — validado pela assinatura Stripe (`STRIPE_WEBHOOK_SECRET`)
- Body raw (não parseado como JSON — necessário para validação de assinatura)
- Eventos tratados:
  - `checkout.session.completed` → atualiza `plano_id` e `stripe_customer_id` em `usuarios`
  - `customer.subscription.deleted` → rebaixa para `plano_id = 'free'`
  - `invoice.payment_failed` → log (notificação ao usuário fora do escopo inicial)
- Sempre retorna `200` para eventos reconhecidos (evita reentrega do Stripe)
- Retorna `400` apenas para assinatura inválida

### Banco de dados

**Migração em `usuarios`:**
```sql
ALTER TABLE public.usuarios ADD COLUMN stripe_customer_id text;
```

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
```

**Setup no Stripe Dashboard (modo teste):**
1. Criar produto "DevInsight Pro" com preço recorrente R$49/mês
2. Criar produto "DevInsight Scale" com preço recorrente R$149/mês
3. Copiar os `price_id` para as variáveis de ambiente

---

## Tratamento de Erros

| Situação | Resposta |
|----------|----------|
| Usuário já tem o plano solicitado | `400 { erro: "Você já possui este plano" }` |
| Token ausente ou inválido em `/checkout` | `401` |
| Plano inválido no body | `400 { erro: "Plano inválido" }` |
| Stripe indisponível | `502 { erro: "Erro ao processar pagamento. Tente novamente." }` |
| Webhook com assinatura inválida | `400` silencioso |
| `usuario_id` do webhook não encontrado no banco | loga erro, retorna `200` |
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
1. Pagamento bem-sucedido → `plano_id` atualizado no banco
2. Pagamento recusado → plano não muda
3. Fechar Stripe sem pagar → volta para pricing sem alteração
4. Webhook com assinatura inválida → rejeitado com `400`

### Testes automatizados
- `POST /v1/billing/checkout` com JWT válido → retorna `{ url }`
- `POST /v1/billing/checkout` sem JWT → `401`
- `POST /v1/billing/checkout` com plano já ativo → `400`
- `POST /v1/billing/webhook` com assinatura inválida → `400`

---

## Fora do Escopo (versão inicial)

- Créditos proporcionais em upgrades no meio do ciclo
- Tela de gerenciamento de assinatura (cancelar, trocar plano)
- Notificação por email em falha de pagamento
- Plano Enterprise (ativação manual)
- Notas fiscais
