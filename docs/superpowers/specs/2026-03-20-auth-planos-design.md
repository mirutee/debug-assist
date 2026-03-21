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
- `POST /v1/auth/login` — autentica com email/senha, retorna JWT do Supabase Auth
- `GET /v1/auth/me` — retorna dados do usuário + API Key (autenticado via JWT)
- Middleware de auth reescrito para validação por usuário + verificação de cota
- Anti-abuso no signup: bloqueio de emails descartáveis + rate limit por IP
- Reset mensal de `uso_mensal` via pg_cron no Supabase (UTC)

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

O trigger dispara no **UPDATE** de `auth.users` quando `confirmed_at` muda de NULL para um valor (email confirmado). Isso garante que o registro em `usuarios` só existe após confirmação real.

```sql
CREATE OR REPLACE FUNCTION handle_user_confirmed()
RETURNS trigger AS $$
BEGIN
  -- Só age quando confirmed_at passa de NULL para preenchido
  IF OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL THEN
    INSERT INTO public.usuarios (auth_id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (auth_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_user_confirmed();
```

### pg_cron — reset mensal

Executa às 00:00 UTC do dia 1° de cada mês (equivale a 21:00 BRT do último dia do mês anterior). Documentar para suporte: o reset acontece em UTC, não em horário de Brasília.

```sql
SELECT cron.schedule('reset-uso-mensal', '0 0 1 * *',
  'UPDATE public.usuarios SET uso_mensal = 0');
```

**Nota timezone:** UTC-3 (BRT) significa que o reset ocorre às 21:00 do último dia do mês para usuários brasileiros. Aceito como trade-off do MVP — documentar no README operacional.

---

## 2. Fluxo de Signup e Login

### 2.1 Signup

```
POST /v1/auth/signup  { email, senha }
        │
        ├─ Valida formato do email
        ├─ Valida senha (mínimo 6 caracteres — requisito do Supabase Auth)
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
  Trigger on_auth_user_confirmed
        └─ INSERT em usuarios (auth_id, email, api_key=gen_random_uuid(), plano='free')
```

**A API Key não é retornada no signup.** O usuário faz login para obter um JWT e então busca a key via `GET /v1/auth/me`.

### 2.2 Login

```
POST /v1/auth/login  { email, senha }
        │
        ▼
  Supabase Auth.signInWithPassword(email, senha)
        │
        ├─ Credenciais inválidas → 401 { erro: "Email ou senha incorretos" }
        ├─ Email não confirmado → 403 { erro: "Confirme seu email antes de fazer login" }
        └─ Sucesso → 200 { token: "<supabase-jwt>", token_type: "Bearer" }
```

### 2.3 GET /v1/auth/me

Autenticado via **Supabase JWT** (não via API Key — evita o problema circular de precisar da key para buscar a key).

```
GET /v1/auth/me
Authorization: Bearer <supabase-jwt>
        │
        ▼
  Supabase Auth.getUser(jwt)  →  { id: auth_id }
        │
        ▼
  SELECT u.*, p.limite_mensal
  FROM usuarios u JOIN planos p ON u.plano_id = p.id
  WHERE u.auth_id = $1
        │
        └─ Retorna 200:
           {
             "email": "user@example.com",
             "plano": "free",
             "uso_mensal": 42,
             "limite_mensal": 100,
             "api_key": "uuid-da-key"
           }
```

Esta rota usa o JWT do Supabase para autenticar, **não o middleware de cotas**. Não consome cota mensal.

---

## 3. Middleware de Auth + Cotas

Usado em `POST /v1/diagnosticos` (e futuros endpoints pagos). **Não** é usado em `/v1/auth/*`.

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

**Incremento de uso:** `src/routes/diagnosticos.js` chama `incrementarUso(req.usuario.id)` após retornar a resposta com sucesso (`res.on('finish', ...)`). Erros de validação não consomem cota.

**Limitação conhecida (MVP):** verificação e incremento são operações separadas. Sob alta concorrência do mesmo usuário, a cota pode ser ultrapassada marginalmente. Mitigação com `UPDATE ... WHERE uso_mensal < limite_mensal` fica para versão futura.

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
- O trigger só cria o registro em `usuarios` após confirmação — usuário não confirmado não tem API Key

---

## 5. Arquivos Afetados

### Modificados
| Arquivo | Mudança |
|---|---|
| `src/middleware/auth.js` | Reescrito — valida api_key na tabela `usuarios` + verifica cota |
| `src/db/supabase.js` | Adiciona `getUsuarioByApiKey()`, `incrementarUso()`, `getUsuarioByAuthId()` |
| `src/app.js` | Registra rota `/v1/auth` |
| `src/routes/diagnosticos.js` | Adiciona chamada a `incrementarUso()` via `res.on('finish', ...)` |

### Criados
| Arquivo | Conteúdo |
|---|---|
| `src/routes/auth.js` | `POST /v1/auth/signup`, `POST /v1/auth/login`, `GET /v1/auth/me` |
| `src/middleware/antiAbuse.js` | Rate limit de signup + validação de domínio |
| `src/data/blocked-domains.js` | Lista de domínios descartáveis |
| `migrations/001_usuarios_planos.sql` | Raiz do projeto (`C:\PROJETOS\API\migrations\`). Tabelas, trigger, pg_cron — executar manualmente no Supabase SQL Editor |

### Inalterados
- `src/engines/` — nenhuma mudança
- `src/routes/health.js` — nenhuma mudança
- `src/middleware/validate.js` — nenhuma mudança

---

## 6. Tratamento de Erros

| Situação | HTTP | Resposta |
|---|---|---|
| Header Authorization ausente (diagnosticos) | 401 | `{ erro: "API Key obrigatória" }` |
| API Key não encontrada / inativa | 401 | `{ erro: "API Key inválida" }` |
| Cota mensal esgotada | 429 | `{ erro: "Cota mensal esgotada. Faça upgrade do seu plano." }` |
| Email descartável no signup | 400 | `{ erro: "Email não permitido" }` |
| Muitos signups pelo mesmo IP | 429 | `{ erro: "Limite de cadastros atingido. Tente novamente em 24h." }` |
| Email já cadastrado | 400 | `{ erro: "Email já cadastrado" }` |
| Senha inválida (< 6 caracteres) | 400 | `{ erro: "Senha inválida. Mínimo 6 caracteres." }` |
| Email ou senha incorretos no login | 401 | `{ erro: "Email ou senha incorretos" }` |
| Email não confirmado no login | 403 | `{ erro: "Confirme seu email antes de fazer login" }` |
| Erro interno do Supabase | 500 | `{ erro: "Erro interno. Tente novamente." }` |

---

## 7. Testes

### Arquivos de teste
- `tests/routes/auth.test.js` — signup válido, email descartável, senha curta, rate limit, login, me com JWT válido
- `tests/middleware/auth.test.js` — **reescrito**: mock de `getUsuarioByApiKey` via `jest.mock('../db/supabase')` (key válida, inválida, cota esgotada, plano enterprise sem limite)

### Estratégia
- Supabase mockado nos testes (sem chamadas reais ao banco)
- `jest.mock('@supabase/supabase-js')` para testes de signup/login
- Testes de integração reais ficam para fase de staging/deploy

---

## Decisões de Design

| Decisão | Motivo |
|---|---|
| Supabase Auth apenas para signup/email/login | Auth foi feito para isso; validação de Bearer API Key é mais rápida em tabela própria |
| GET /v1/auth/me usa JWT, não API Key | Evita dependência circular (precisar da key para buscar a key) |
| API Key como UUID v4 | Simples, suficientemente seguro para MVP, sem dependências extras |
| Trigger em AFTER UPDATE (confirmed_at) | Garante que `usuarios` só tem registros com email confirmado |
| Incremento via `res.on('finish')` | Desacopla o incremento da lógica de negócio; erros não consomem cota |
| Lista de domínios local | Zero latência, sem API externa, suficiente para ~80% dos abusos |
| pg_cron no Supabase (UTC) | Reset não depende do servidor estar no ar; UTC aceito como trade-off do MVP |
