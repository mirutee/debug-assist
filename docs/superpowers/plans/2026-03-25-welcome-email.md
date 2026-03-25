# Welcome Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar email HTML de boas-vindas via Resend após signup bem-sucedido, incluindo API key, exemplo curl e links para dashboard e docs.

**Architecture:** Novo módulo `src/email/resend.js` expõe `sendWelcomeEmail(email, apiKey)`. O `auth.js` chama essa função em fire-and-forget após `signUpUser` retornar sucesso — falha no email nunca falha o signup. A API key é buscada via `getUsuarioByAuthId` logo após o signup; se não disponível (race condition), o email é enviado sem ela. URLs no template usam `APP_BASE_URL` do ambiente.

**Tech Stack:** Node.js/Express, Resend SDK (`resend` npm), Jest para testes.

---

## Files

- Create: `src/email/resend.js` — cliente Resend + função `sendWelcomeEmail(email, apiKey)`
- Modify: `src/routes/auth.js` — chamar `sendWelcomeEmail` após signup bem-sucedido
- Modify: `tests/routes/auth.test.js` — adicionar mock do resend + 2 testes
- Modify: `.env.example` — documentar `RESEND_API_KEY` e `RESEND_FROM`

---

### Task 1: Instalar Resend e configurar variáveis de ambiente

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Instalar o pacote resend**

```bash
npm install resend
```

Expected: `resend` aparece em `dependencies` no `package.json`.

- [ ] **Step 2: Adicionar variáveis ao `.env.example`**

Adicionar ao final de `.env.example`:

```
# Email (Resend) — obter chave em resend.com/api-keys
RESEND_API_KEY=re_...
# Domínio remetente verificado no Resend (use onboarding@resend.dev para testes)
RESEND_FROM=noreply@debug-assist.app
```

- [ ] **Step 3: Adicionar as variáveis ao `.env` local**

```
RESEND_API_KEY=<sua chave do painel resend.com>
RESEND_FROM=noreply@debug-assist.app
```

> Para obter a chave: resend.com → API Keys → Create API Key. Para testes sem domínio verificado, use `RESEND_FROM=onboarding@resend.dev` — funciona apenas para o email da própria conta Resend.

- [ ] **Step 4: Commit**

```bash
git add .env.example package.json package-lock.json
git commit -m "chore: instalar resend e documentar variáveis de ambiente"
```

---

### Task 2: Criar `src/email/resend.js`

**Files:**
- Create: `src/email/resend.js`

- [ ] **Step 1: Criar o arquivo com cliente e template HTML**

```js
// src/email/resend.js
const { Resend } = require('resend');

let _resend;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || '');
  return _resend;
}

function buildWelcomeHtml(email, apiKey) {
  const baseUrl = (process.env.APP_BASE_URL || 'https://devinsight-api.onrender.com').replace(/\/$/, '');

  const apiKeyBlock = apiKey
    ? `
      <div style="margin:24px 0">
        <p style="color:#94A3B8;font-size:13px;margin:0 0 8px">Sua API Key:</p>
        <div style="background:#0D1117;border:1px solid #334155;border-radius:8px;padding:16px;font-family:'JetBrains Mono',monospace;font-size:13px;color:#4ADE80;word-break:break-all">${apiKey}</div>
      </div>`
    : `
      <p style="color:#94A3B8;font-size:14px">Sua API Key estará disponível no dashboard após confirmar seu email.</p>`;

  const curlExample = apiKey
    ? `
      <div style="margin:24px 0">
        <p style="color:#94A3B8;font-size:13px;margin:0 0 8px">Exemplo rápido:</p>
        <div style="background:#0D1117;border:1px solid #334155;border-radius:8px;padding:16px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#F8FAFC;white-space:pre-wrap">curl -X POST ${baseUrl}/v1/diagnosticos \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"/users","method":"POST","categoria":"backend"}'</div>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0F172A;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#1E293B;border:1px solid #334155;border-radius:12px;overflow:hidden">

    <!-- Header -->
    <div style="background:#0F172A;padding:24px 32px;border-bottom:1px solid #334155">
      <span style="font-family:'JetBrains Mono',monospace;font-weight:700;font-size:20px;color:#6366F1">DEBUG_Assist</span><span style="display:inline-block;width:2px;height:1em;background:#6366F1;margin-left:2px;vertical-align:middle"></span>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <h1 style="color:#F8FAFC;font-size:22px;font-weight:700;margin:0 0 8px">Bem-vindo ao DEBUG_Assist!</h1>
      <p style="color:#94A3B8;font-size:15px;margin:0 0 24px">Sua conta foi criada com sucesso para <strong style="color:#F8FAFC">${email}</strong>.</p>

      ${apiKeyBlock}
      ${curlExample}

      <!-- Botões -->
      <div style="margin:32px 0 0">
        <a href="${baseUrl}/dashboard/" style="display:inline-block;background:#6366F1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;margin-right:12px">Acessar Dashboard →</a>
        <a href="${baseUrl}/docs" style="display:inline-block;background:transparent;color:#6366F1;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;border:1px solid #6366F1">Ver Documentação</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #334155;text-align:center">
      <p style="color:#475569;font-size:12px;margin:0">© 2026 DEBUG_Assist</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendWelcomeEmail(email, apiKey) {
  try {
    await getResend().emails.send({
      from: process.env.RESEND_FROM || 'noreply@debug-assist.app',
      to: email,
      subject: 'Bem-vindo ao DEBUG_Assist — sua API Key está aqui',
      html: buildWelcomeHtml(email, apiKey),
    });
  } catch (err) {
    console.error('[email] Erro ao enviar email de boas-vindas:', err.message);
  }
}

module.exports = { sendWelcomeEmail };
```

- [ ] **Step 2: Commit**

```bash
git add src/email/resend.js
git commit -m "feat: criar módulo de email de boas-vindas com Resend"
```

---

### Task 3: Integrar email no signup (TDD)

**Files:**
- Modify: `tests/routes/auth.test.js`
- Modify: `src/routes/auth.js`

- [ ] **Step 1: Adicionar mock do resend em `tests/routes/auth.test.js`**

Adicionar logo após o bloco `jest.mock("../../src/db/supabase", ...)`:

```js
jest.mock('../../src/email/resend', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
}));

const { sendWelcomeEmail } = require('../../src/email/resend');
```

- [ ] **Step 2: Adicionar 2 testes ao `describe('POST /v1/auth/signup')`**

Adicionar antes do `});` que fecha o describe de signup:

```js
  it('chama sendWelcomeEmail com o email e api_key corretos após signup válido', async () => {
    signUpUser.mockResolvedValue({
      data: { user: { id: 'auth-uuid' } },
      error: null,
    });
    getUsuarioByAuthId.mockResolvedValue({ api_key: 'key-abc123' });

    await request(app)
      .post('/v1/auth/signup')
      .send({ email: 'user@gmail.com', senha: 'senha123' });

    expect(sendWelcomeEmail).toHaveBeenCalledWith('user@gmail.com', 'key-abc123');
  });

  it('retorna 201 mesmo quando sendWelcomeEmail lança erro', async () => {
    signUpUser.mockResolvedValue({
      data: { user: { id: 'auth-uuid' } },
      error: null,
    });
    getUsuarioByAuthId.mockResolvedValue({ api_key: 'key-abc123' });
    sendWelcomeEmail.mockRejectedValueOnce(new Error('resend error'));

    const res = await request(app)
      .post('/v1/auth/signup')
      .send({ email: 'user@gmail.com', senha: 'senha123' });

    expect(res.status).toBe(201);
  });
```

- [ ] **Step 3: Rodar testes para confirmar falha**

```bash
npm test -- tests/routes/auth.test.js --no-coverage
```

Expected: 2 novos testes FAIL — `sendWelcomeEmail` não é chamado pois ainda não foi integrado ao `auth.js`.

- [ ] **Step 4: Adicionar import do `sendWelcomeEmail` em `src/routes/auth.js`**

Adicionar no topo do arquivo, após os outros `require`:

```js
const { sendWelcomeEmail } = require('../email/resend');
```

- [ ] **Step 5: Extrair `data` do retorno de `signUpUser` em `src/routes/auth.js`**

No handler de signup, a linha atual é:

```js
const { error } = await signUpUser(email, senha);
```

Substituir por:

```js
const { data, error } = await signUpUser(email, senha);
```

- [ ] **Step 6: Buscar API key e disparar email após signup bem-sucedido**

Localizar a linha `return res.status(201).json(...)` e adicionar antes dela:

```js
    // Buscar API key para o email (fire-and-forget — nunca bloqueia o signup)
    const authId = data?.user?.id;
    let apiKey = null;
    if (authId) {
      try {
        const usuario = await getUsuarioByAuthId(authId);
        apiKey = usuario?.api_key || null;
      } catch (_) {}
    }
    sendWelcomeEmail(email, apiKey).catch(() => {});
```

- [ ] **Step 7: Rodar testes para confirmar que passam**

```bash
npm test -- tests/routes/auth.test.js --no-coverage
```

Expected: 14 testes, todos PASS (12 existentes + 2 novos).

- [ ] **Step 8: Rodar suite completa**

```bash
npm test --no-coverage
```

Expected: 157 testes, 21 suites, todos PASS.

- [ ] **Step 9: Commit**

```bash
git add src/routes/auth.js tests/routes/auth.test.js
git commit -m "feat: enviar email de boas-vindas via Resend após signup"
```

---

### Task 4: Configurar Resend em produção e deploy

**Files:** nenhum (configuração externa + push)

- [ ] **Step 1: Verificar domínio remetente no Resend**

Acesse resend.com → Domains → Add Domain → adicionar seu domínio.
Seguir instruções de DNS (registros MX/TXT/DKIM).

> Sem domínio verificado: use `RESEND_FROM=onboarding@resend.dev` temporariamente — funciona apenas para o email da sua própria conta Resend.

- [ ] **Step 2: Adicionar variáveis no Render**

No painel do Render → seu serviço → Environment:
- `RESEND_API_KEY` = sua chave do painel Resend
- `RESEND_FROM` = `noreply@debug-assist.app` (ou `onboarding@resend.dev` para teste)

- [ ] **Step 3: Push e deploy**

```bash
git push origin master
```

Aguardar ~2 minutos para o Render fazer deploy.

- [ ] **Step 4: Testar manualmente**

Criar uma nova conta em `/dashboard/signup.html` e verificar se o email chega na caixa de entrada.
