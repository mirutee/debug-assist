# DevInsight API — Auth por Usuário & Planos com Cotas

**Data:** 2026-03-20
**Fase:** Core product — autenticação por usuário, planos e controle de cota mensal
**Status:** Aprovado pelo usuário

---

## Contexto

O MVP atual usa uma única `API_KEY` em variável de ambiente para autenticar todas as requisições. Este design substitui esse modelo por autenticação por usuário, com planos diferenciados (Free/Pro/Scale/Enterprise) e controle de cota mensal, adicionando proteção contra abuso no cadastro.

---

## Escopo desta fase

- Tabelas `planos` e `usuarios` no Supabase
- `POST /v1/auth/signup` — cadastro com verificação de email via Supabase Auth
- `GET /v1/auth/me` — retorna dados do usuário autenticado (incluindo API Key)
- Middleware de auth reescrito para validação por usuário + verificação de cota
- Anti-abuso no signup: bloqueio de emails descartáveis + rate limit por IP
- Reset mensal de `uso_mensal` via pg_cron no Supabase

**Fora do escopo:** dashboard frontend, landing page, pagamentos, deploy.

---

## 1. Schema do Banco de Dados

### Tabela `planos`

```sql
CREATE TABLE planos (
  id             text PRIMARY KEY,         -- 'free', 'pro', 'scale', 'enterprise'
  nome           text NOT NULL,
  limite_mensal  integer NOT NULL,         -- -1 = ilimitado
  preco_brl      numeric(10,2)
);

INSERT INTO planos VALUES
  ('free',       'Free',       100,    0),
  ('pro',        'Pro',        1000,   29.00),
  ('scale',      'Scale',      10000,  99.00),
  ('enterprise', 'Enterprise', -1,     NULL);
```

### Tabela `usuarios`

```sql
CREATE TABLE usuarios (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id      uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text UNIQUE NOT NULL,
  api_key      uuid UNIQUE DEFAULT gen_random_uuid(),
  plano_id     text REFERENCES planos(id) DEFAULT 'free',
  uso_mensal   integer NOT NULL DEFAULT 0,
  ativo        boolean NOT NULL DEFAULT true,
  criado_em    timestamptz DEFAULT now()
);
```

### Trigger pós-confirmação de email

Cria automaticamente o registro em `usuarios` quando o Supabase Auth confirma o email do usuário:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.usuarios (auth_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### pg_cron — reset mensal

```sql
SELECT cron.schedule('reset-uso-mensal', '0 0 1 * *',
  'UPDATE usuarios SET uso_mensal = 0');
```

---

## 2. Fluxo de Signup

```
POST /v1/auth/signup  { email, senha }
        │
        ├─ Valida formato do email
        ├─ Bloqueia domínios descartáveis (lista local ~200 domínios)
        ├─ Rate limit: máx 3 signups por IP em janela de 24h
        │
        ▼
  Supabase Auth.signUp(email, senha)
        │
        ├─ Supabase envia email de confirmação
        └─ Retorna 201: { mensagem: "Verifique seu email para ativar a conta" }

  (usuário clica no link de confirmação)
        │
        ▼
  Trigger on_auth_user_created
        └─ INSERT em usuarios (auth_id, email, api_key=gen_random_uuid(), plano='free')
```

**A API Key não é retornada no signup.** O usuário acessa via `GET /v1/auth/me` após login.

### GET /v1/auth/me

Requer `Authorization: Bearer <api_key>`. Retorna:
```json
{
  "email": "user@example.com",
  "plano": "free",
  "uso_mensal": 42,
  "limite_mensal": 100,
  "api_key": "uuid-da-key"
}
```

---

## 3. Middleware de Auth + Cotas

Substitui o `src/middleware/auth.js` atual (que valida contra `process.env.API_KEY`):

```
Request: Authorization: Bearer <api_key>
        │
        ├─ Header ausente → 401 { erro: "API Key obrigatória" }
        │
        ▼
  SELECT u.*, p.limite_mensal
  FROM usuarios u
  JOIN planos p ON u.plano_id = p.id
  WHERE u.api_key = $1 AND u.ativo = true
        │
        ├─ Não encontrado → 401 { erro: "API Key inválida" }
        ├─ limite_mensal != -1 AND uso_mensal >= limite_mensal
        │     → 429 { erro: "Cota mensal esgotada. Faça upgrade do seu plano." }
        │
        ▼
  req.usuario = { id, plano_id, uso_mensal, limite_mensal }
  next()
```

**Incremento de uso:** após diagnóstico bem-sucedido, `UPDATE usuarios SET uso_mensal = uso_mensal + 1`. Erros de validação não consomem cota.

---

## 4. Anti-Abuso no Signup

Três camadas aplicadas em `POST /v1/auth/signup`:

### 4.1 Bloqueio de emails descartáveis
- Lista local de ~200 domínios conhecidos (mailinator.com, guerrillamail.com, temp-mail.org, etc.)
- Verificação síncrona: `email.split('@')[1] ∈ BLOCKED_DOMAINS`
- Resposta: `400 { erro: "Email não permitido" }`

### 4.2 Rate limit por IP no signup
- `express-rate-limit` com `windowMs: 24 * 60 * 60 * 1000`, `max: 3`
- Resposta: `429 { erro: "Limite de cadastros atingido. Tente novamente em 24h." }`

### 4.3 Verificação de email (Supabase Auth)
- API Key só existe após confirmação — usuário não confirmado não tem registro em `usuarios`

---

## 5. Arquivos Afetados

### Modificados
| Arquivo | Mudança |
|---|---|
| `src/middleware/auth.js` | Reescrito — valida api_key na tabela `usuarios` + verifica cota |
| `src/db/supabase.js` | Adiciona `getUsuarioByApiKey()` e `incrementarUso()` |
| `src/app.js` | Registra rota `/v1/auth` |

### Criados
| Arquivo | Conteúdo |
|---|---|
| `src/routes/auth.js` | `POST /v1/auth/signup`, `GET /v1/auth/me` |
| `src/middleware/antiAbuse.js` | Rate limit de signup + validação de domínio |
| `src/data/blocked-domains.js` | Lista de domínios descartáveis |
| `migrations/001_usuarios_planos.sql` | Tabelas, trigger, pg_cron |

### Inalterados
- `src/engines/` — nenhuma mudança
- `src/routes/diagnosticos.js` — nenhuma mudança
- `src/routes/health.js` — nenhuma mudança
- `src/middleware/validate.js` — nenhuma mudança

---

## 6. Tratamento de Erros

| Situação | HTTP | Resposta |
|---|---|---|
| Header Authorization ausente | 401 | `{ erro: "API Key obrigatória" }` |
| API Key não encontrada / inativa | 401 | `{ erro: "API Key inválida" }` |
| Cota mensal esgotada | 429 | `{ erro: "Cota mensal esgotada. Faça upgrade do seu plano." }` |
| Email descartável no signup | 400 | `{ erro: "Email não permitido" }` |
| Muitos signups pelo mesmo IP | 429 | `{ erro: "Limite de cadastros atingido. Tente novamente em 24h." }` |
| Email já cadastrado | 400 | `{ erro: "Email já cadastrado" }` |
| Erro interno do Supabase | 500 | `{ erro: "Erro interno. Tente novamente." }` |

---

## 7. Testes

### Novos arquivos de teste
- `tests/routes/auth.test.js` — signup válido, email descartável, rate limit, me sem key, me com key válida
- `tests/middleware/auth.test.js` — reescrito para mock de `getUsuarioByApiKey` (key válida, inválida, cota esgotada)

### Estratégia
- Supabase mockado nos testes (sem chamadas reais ao banco)
- Testes de integração reais ficam para fase de staging/deploy

---

## Decisões de Design

| Decisão | Motivo |
|---|---|
| Supabase Auth apenas para signup/email | Auth foi feito para isso; validação de Bearer token é mais rápida em tabela própria |
| API Key como UUID v4 | Simples, suficientemente seguro para MVP, sem dependências extras |
| Incremento pós-sucesso | Erros não consomem cota — melhor UX e evita penalizar erros de integração |
| Lista de domínios local | Zero latência, sem API externa, suficiente para ~80% dos abusos |
| pg_cron no Supabase | Reset não depende do servidor estar no ar |
