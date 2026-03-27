# Configurações + Analytics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a página `/dashboard/configuracoes.html` com dados da conta, rotação de API Key (com confirmação) e gráfico de barras com uso dos últimos 30 dias.

**Architecture:** Dois novos endpoints Express (`POST /v1/auth/regenerate-key` e `GET /v1/analytics`) + página vanilla HTML/JS estática servida pelo Express. Analytics agrupa registros de `diagnosticos` por dia no lado do servidor (sem nova tabela). Gráfico SVG gerado inline por JS.

**Tech Stack:** Node.js, Express, Supabase JS client, Vanilla HTML/CSS/JS, Jest + supertest

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/db/supabase.js` | Modificar | Adicionar `regenerateApiKey` e `getAnalyticsByUsuario` |
| `src/routes/auth.js` | Modificar | Adicionar rota `POST /regenerate-key` |
| `src/routes/analytics.js` | Criar | Rota `GET /v1/analytics` |
| `src/app.js` | Modificar | Registrar `/v1/analytics` |
| `public/dashboard/configuracoes.html` | Criar | Página de configurações |
| `public/dashboard/index.html` | Modificar | Link Configurações na sidebar |
| `public/dashboard/historico.html` | Modificar | Link Configurações na sidebar |
| `public/dashboard/alertas.html` | Modificar | Link Configurações na sidebar |
| `tests/db/supabase.test.js` | Modificar | Testes para as duas novas funções DB |
| `tests/routes/auth.test.js` | Modificar | Testes para `POST /regenerate-key` |
| `tests/routes/analytics.test.js` | Criar | Testes para `GET /v1/analytics` |

---

### Task 1: Funções DB — `regenerateApiKey` e `getAnalyticsByUsuario`

**Files:**
- Modify: `src/db/supabase.js`
- Modify: `tests/db/supabase.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `tests/db/supabase.test.js`, antes do `module.exports` (o arquivo não tem exports — adicionar como novos `describe` blocos):

```js
const { regenerateApiKey, getAnalyticsByUsuario } = require("../../src/db/supabase");

describe("regenerateApiKey", () => {
  it("retorna a nova api_key após update bem-sucedido", async () => {
    mockSupabaseClient.from.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { api_key: "nova-key-uuid" },
              error: null,
            }),
          }),
        }),
      }),
    });

    const result = await regenerateApiKey("user-uuid");
    expect(result).toBe("nova-key-uuid");
  });

  it("lança erro se update falhar", async () => {
    mockSupabaseClient.from.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: "update failed" },
            }),
          }),
        }),
      }),
    });

    await expect(regenerateApiKey("user-uuid")).rejects.toThrow("update failed");
  });
});

describe("getAnalyticsByUsuario", () => {
  it("retorna dados agrupados por data", async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({
            data: [
              { criado_em: "2026-03-01T10:00:00Z" },
              { criado_em: "2026-03-01T12:00:00Z" },
              { criado_em: "2026-03-02T09:00:00Z" },
            ],
            error: null,
          }),
        }),
      }),
    });

    const result = await getAnalyticsByUsuario("user-uuid");
    expect(result).toEqual([
      { data: "2026-03-01", total: 2 },
      { data: "2026-03-02", total: 1 },
    ]);
  });

  it("retorna array vazio se não houver diagnósticos", async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const result = await getAnalyticsByUsuario("user-uuid");
    expect(result).toEqual([]);
  });

  it("lança erro se query falhar", async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "query failed" },
          }),
        }),
      }),
    });

    await expect(getAnalyticsByUsuario("user-uuid")).rejects.toThrow("query failed");
  });
});
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
npx jest tests/db/supabase.test.js --no-coverage
```

Esperado: FAIL — `regenerateApiKey is not a function` e `getAnalyticsByUsuario is not a function`

- [ ] **Step 3: Implementar as duas funções em `src/db/supabase.js`**

Adicionar após a função `getUsuarioByStripeCustomerId` (linha 117) e antes do `module.exports`:

```js
async function regenerateApiKey(usuarioId) {
  const { data, error } = await supabase
    .from("usuarios")
    .update({ api_key: require("crypto").randomUUID() })
    .eq("id", usuarioId)
    .select("api_key")
    .single();

  if (error || !data) throw new Error(error?.message || "Erro ao regenerar API key");
  return data.api_key;
}

async function getAnalyticsByUsuario(usuarioId) {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase
    .from("diagnosticos")
    .select("criado_em")
    .eq("usuario_id", usuarioId)
    .gte("criado_em", since.toISOString());

  if (error) throw new Error(error.message);

  const counts = {};
  for (const row of data || []) {
    const date = row.criado_em.slice(0, 10);
    counts[date] = (counts[date] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([data, total]) => ({ data, total }))
    .sort((a, b) => a.data.localeCompare(b.data));
}
```

Adicionar as duas funções ao `module.exports`:

```js
module.exports = {
  saveDiagnostico,
  getDiagnosticosByUsuario,
  getUsuarioByApiKey,
  incrementarUso,
  getUsuarioByAuthId,
  signUpUser,
  signInUser,
  getUserFromToken,
  getUsuarioById,
  updatePlanoBilling,
  getUsuarioByStripeCustomerId,
  regenerateApiKey,
  getAnalyticsByUsuario,
};
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
npx jest tests/db/supabase.test.js --no-coverage
```

Esperado: PASS — todos os testes verdes

- [ ] **Step 5: Commit**

```bash
git add src/db/supabase.js tests/db/supabase.test.js
git commit -m "feat(db): adicionar regenerateApiKey e getAnalyticsByUsuario"
```

---

### Task 2: Endpoint `POST /v1/auth/regenerate-key`

**Files:**
- Modify: `src/routes/auth.js`
- Modify: `tests/routes/auth.test.js`

- [ ] **Step 1: Escrever os testes que falham**

No arquivo `tests/routes/auth.test.js`, adicionar `regenerateApiKey` ao mock do supabase no topo:

```js
// Alterar a linha do jest.mock("../../src/db/supabase", ...) para incluir regenerateApiKey:
jest.mock("../../src/db/supabase", () => ({
  saveDiagnostico: jest.fn().mockResolvedValue(undefined),
  getUsuarioByApiKey: jest.fn().mockResolvedValue({
    id: "user-test-uuid",
    plano_id: "free",
    uso_mensal: 10,
    planos: { limite_mensal: 100 },
  }),
  incrementarUso: jest.fn().mockResolvedValue(undefined),
  getUsuarioByAuthId: jest.fn(),
  signUpUser: jest.fn(),
  signInUser: jest.fn(),
  getUserFromToken: jest.fn(),
  regenerateApiKey: jest.fn(),
}));
```

Adicionar `regenerateApiKey` ao destructuring existente:

```js
const {
  signUpUser,
  signInUser,
  getUserFromToken,
  getUsuarioByAuthId,
  regenerateApiKey,
} = require("../../src/db/supabase");
```

Adicionar os novos testes ao final do arquivo:

```js
describe("POST /v1/auth/regenerate-key", () => {
  it("retorna 401 sem token", async () => {
    const res = await request(app).post("/v1/auth/regenerate-key");
    expect(res.status).toBe(401);
  });

  it("retorna 401 com token inválido", async () => {
    getUserFromToken.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });

    const res = await request(app)
      .post("/v1/auth/regenerate-key")
      .set("Authorization", "Bearer token-invalido");

    expect(res.status).toBe(401);
  });

  it("retorna 404 se usuário não existe na tabela usuarios", async () => {
    getUserFromToken.mockResolvedValue({ data: { user: { id: "auth-uuid" } }, error: null });
    getUsuarioByAuthId.mockResolvedValue(null);

    const res = await request(app)
      .post("/v1/auth/regenerate-key")
      .set("Authorization", "Bearer token-valido");

    expect(res.status).toBe(404);
  });

  it("retorna 200 com nova api_key", async () => {
    getUserFromToken.mockResolvedValue({ data: { user: { id: "auth-uuid" } }, error: null });
    getUsuarioByAuthId.mockResolvedValue({ id: "user-uuid", email: "user@exemplo.com" });
    regenerateApiKey.mockResolvedValue("nova-key-gerada");

    const res = await request(app)
      .post("/v1/auth/regenerate-key")
      .set("Authorization", "Bearer token-valido");

    expect(res.status).toBe(200);
    expect(res.body.api_key).toBe("nova-key-gerada");
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falham**

```bash
npx jest tests/routes/auth.test.js --no-coverage
```

Esperado: FAIL — `Cannot POST /v1/auth/regenerate-key`

- [ ] **Step 3: Implementar a rota em `src/routes/auth.js`**

Adicionar o import de `regenerateApiKey` na linha 5:

```js
const { validarDominio, signupLimiter } = require("../middleware/antiAbuse");
const { signUpUser, signInUser, getUserFromToken, getUsuarioByAuthId, regenerateApiKey } = require("../db/supabase");
const { sendWelcomeEmail } = require('../email/resend');
```

Adicionar a rota antes de `module.exports = router;`:

```js
// POST /v1/auth/regenerate-key
router.post("/regenerate-key", async (req, res) => {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).json({ erro: "Token obrigatório" });

  const token = header.replace("Bearer ", "").trim();

  try {
    const { data: { user }, error } = await getUserFromToken(token);
    if (error || !user) return res.status(401).json({ erro: "Token inválido" });

    const usuario = await getUsuarioByAuthId(user.id);
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });

    const apiKey = await regenerateApiKey(usuario.id);
    return res.json({ api_key: apiKey });
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno. Tente novamente." });
  }
});
```

- [ ] **Step 4: Rodar para confirmar que passam**

```bash
npx jest tests/routes/auth.test.js --no-coverage
```

Esperado: PASS — todos os testes verdes

- [ ] **Step 5: Commit**

```bash
git add src/routes/auth.js tests/routes/auth.test.js
git commit -m "feat(auth): adicionar POST /v1/auth/regenerate-key"
```

---

### Task 3: Endpoint `GET /v1/analytics`

**Files:**
- Create: `src/routes/analytics.js`
- Modify: `src/app.js`
- Create: `tests/routes/analytics.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/routes/analytics.test.js`:

```js
// tests/routes/analytics.test.js
jest.mock("../../src/db/supabase", () => ({
  getUserFromToken: jest.fn(),
  getUsuarioByAuthId: jest.fn(),
  getAnalyticsByUsuario: jest.fn(),
}));

const { getUserFromToken, getUsuarioByAuthId, getAnalyticsByUsuario } =
  require("../../src/db/supabase");

beforeEach(() => jest.clearAllMocks());

const request = require("supertest");
const app = require("../../src/app");

describe("GET /v1/analytics", () => {
  it("retorna 401 sem token", async () => {
    const res = await request(app).get("/v1/analytics");
    expect(res.status).toBe(401);
  });

  it("retorna 401 com token inválido", async () => {
    getUserFromToken.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });

    const res = await request(app)
      .get("/v1/analytics")
      .set("Authorization", "Bearer token-invalido");

    expect(res.status).toBe(401);
  });

  it("retorna 404 se usuário não existe", async () => {
    getUserFromToken.mockResolvedValue({ data: { user: { id: "auth-uuid" } }, error: null });
    getUsuarioByAuthId.mockResolvedValue(null);

    const res = await request(app)
      .get("/v1/analytics")
      .set("Authorization", "Bearer token-valido");

    expect(res.status).toBe(404);
  });

  it("retorna 200 com array de dados", async () => {
    getUserFromToken.mockResolvedValue({ data: { user: { id: "auth-uuid" } }, error: null });
    getUsuarioByAuthId.mockResolvedValue({ id: "user-uuid" });
    getAnalyticsByUsuario.mockResolvedValue([
      { data: "2026-03-01", total: 5 },
      { data: "2026-03-02", total: 3 },
    ]);

    const res = await request(app)
      .get("/v1/analytics")
      .set("Authorization", "Bearer token-valido");

    expect(res.status).toBe(200);
    expect(res.body.dados).toHaveLength(2);
    expect(res.body.dados[0]).toEqual({ data: "2026-03-01", total: 5 });
  });

  it("retorna 200 com array vazio se sem diagnósticos", async () => {
    getUserFromToken.mockResolvedValue({ data: { user: { id: "auth-uuid" } }, error: null });
    getUsuarioByAuthId.mockResolvedValue({ id: "user-uuid" });
    getAnalyticsByUsuario.mockResolvedValue([]);

    const res = await request(app)
      .get("/v1/analytics")
      .set("Authorization", "Bearer token-valido");

    expect(res.status).toBe(200);
    expect(res.body.dados).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falham**

```bash
npx jest tests/routes/analytics.test.js --no-coverage
```

Esperado: FAIL — `Cannot GET /v1/analytics`

- [ ] **Step 3: Criar `src/routes/analytics.js`**

```js
// src/routes/analytics.js
const express = require("express");
const router = express.Router();
const { getUserFromToken, getUsuarioByAuthId, getAnalyticsByUsuario } = require("../db/supabase");

router.get("/", async (req, res) => {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).json({ erro: "Token obrigatório" });

  const token = header.replace("Bearer ", "").trim();

  try {
    const { data: { user }, error } = await getUserFromToken(token);
    if (error || !user) return res.status(401).json({ erro: "Token inválido" });

    const usuario = await getUsuarioByAuthId(user.id);
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });

    const dados = await getAnalyticsByUsuario(usuario.id);
    return res.json({ dados });
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno. Tente novamente." });
  }
});

module.exports = router;
```

- [ ] **Step 4: Registrar a rota em `src/app.js`**

Adicionar após a linha `app.use("/v1/billing", require("./routes/billing"));`:

```js
app.use("/v1/analytics", require("./routes/analytics"));
```

- [ ] **Step 5: Rodar para confirmar que passam**

```bash
npx jest tests/routes/analytics.test.js --no-coverage
```

Esperado: PASS — todos os testes verdes

- [ ] **Step 6: Rodar a suite completa para garantir que nada quebrou**

```bash
npx jest --no-coverage
```

Esperado: PASS em todos os arquivos de teste

- [ ] **Step 7: Commit**

```bash
git add src/routes/analytics.js src/app.js tests/routes/analytics.test.js
git commit -m "feat(analytics): adicionar GET /v1/analytics com agrupamento por dia"
```

---

### Task 4: Página `public/dashboard/configuracoes.html`

**Files:**
- Create: `public/dashboard/configuracoes.html`

- [ ] **Step 1: Criar a página**

Criar `public/dashboard/configuracoes.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Configurações — DEBUG_Assist</title>
  <link rel="stylesheet" href="style.css">
  <style>
    .config-section {
      background: var(--card-bg, #1a1a1a);
      border: 1px solid var(--border, #2a2a2a);
      border-radius: 10px;
      padding: 20px 24px;
      margin-bottom: 16px;
    }
    .config-section-label {
      font-size: 10px;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 14px;
    }
    .email-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .email-label {
      font-size: 13px;
      color: #888;
      min-width: 40px;
    }
    .email-value {
      font-size: 13px;
      color: #ccc;
      background: #111;
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid #333;
    }
    .btn-regenerate {
      margin-top: 12px;
      background: transparent;
      border: 1px solid #6366f1;
      color: #6366f1;
      padding: 7px 14px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .btn-regenerate:hover { background: #1e1e2e; }
    .regen-error { color: #f87171; font-size: 12px; margin-top: 8px; display: none; }
    .regen-success { color: #4ade80; font-size: 12px; margin-top: 8px; display: none; }

    /* Modal */
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      z-index: 100;
      align-items: center;
      justify-content: center;
    }
    .modal-overlay.active { display: flex; }
    .modal-box {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 28px;
      max-width: 380px;
      width: 90%;
    }
    .modal-title { font-size: 15px; font-weight: 600; color: #eee; margin-bottom: 10px; }
    .modal-body { font-size: 13px; color: #999; margin-bottom: 20px; line-height: 1.5; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .btn-cancel {
      background: #222;
      border: 1px solid #444;
      color: #ccc;
      padding: 7px 16px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .btn-confirm {
      background: #6366f1;
      border: none;
      color: #fff;
      padding: 7px 16px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }

    /* Analytics chart */
    .chart-container { width: 100%; overflow-x: auto; }
    .chart-svg { display: block; width: 100%; }
    .chart-empty { font-size: 13px; color: #555; text-align: center; padding: 32px 0; }
    .chart-error { font-size: 13px; color: #f87171; margin-top: 8px; }
    .chart-hint { font-size: 11px; color: #555; margin-top: 8px; }

    /* Tooltip */
    #chart-tooltip {
      position: fixed;
      background: #222;
      border: 1px solid #444;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      color: #eee;
      pointer-events: none;
      display: none;
      z-index: 50;
    }
  </style>
</head>
<body>
  <div class="dashboard">
    <nav class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-dot"></div>
        <span class="logo-text">DEBUG_Assist</span>
      </div>
      <a class="nav-item" href="/dashboard/">🏠 Visão Geral</a>
      <a class="nav-item" href="/dashboard/historico.html">📋 Histórico</a>
      <a class="nav-item" href="/dashboard/alertas.html">🔔 Alertas</a>
      <a class="nav-item active">⚙️ Configurações</a>
      <a class="nav-item" href="https://debug-assist.onrender.com/docs" target="_blank" rel="noopener">📖 Docs</a>
      <a class="nav-item" id="btn-sair" href="#">🚪 Sair</a>
      <div class="sidebar-footer" id="user-email">Carregando...</div>
    </nav>

    <main class="main">
      <div class="page-title">Configurações</div>

      <!-- Conta -->
      <div class="config-section">
        <div class="config-section-label">Conta</div>
        <div class="email-row">
          <span class="email-label">Email</span>
          <span class="email-value" id="account-email">Carregando...</span>
        </div>
      </div>

      <!-- API Key -->
      <div class="config-section">
        <div class="config-section-label">API Key</div>
        <div class="apikey-row">
          <div class="apikey-field" id="apikey-field">••••••••-••••-••••-••••-••••••••••••</div>
          <button class="btn-sm" id="btn-reveal" onclick="toggleReveal()">👁 Revelar</button>
          <button class="btn-sm" onclick="copyKey()">📋 Copiar</button>
        </div>
        <div class="copied-feedback" id="copied-feedback">✓ Copiado para a área de transferência!</div>
        <button class="btn-regenerate" onclick="openModal()">🔄 Gerar nova key</button>
        <div class="regen-error" id="regen-error"></div>
        <div class="regen-success" id="regen-success">✓ Nova key gerada com sucesso!</div>
      </div>

      <!-- Analytics -->
      <div class="config-section">
        <div class="config-section-label">Uso dos últimos 30 dias</div>
        <div class="chart-container">
          <div id="chart-area"></div>
        </div>
        <div class="chart-hint">Passe o mouse sobre as barras para ver o total do dia</div>
      </div>
    </main>
  </div>

  <!-- Modal de confirmação -->
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal-box">
      <div class="modal-title">Gerar nova API Key?</div>
      <div class="modal-body">Sua key atual vai parar de funcionar imediatamente. Esta ação não pode ser desfeita.</div>
      <div class="modal-actions">
        <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
        <button class="btn-confirm" id="btn-confirm" onclick="confirmRegenerate()">Sim, gerar nova</button>
      </div>
    </div>
  </div>

  <div id="chart-tooltip"></div>

  <script>
    const API = '';
    let userData = null;
    let revealed = false;

    async function init() {
      const token = localStorage.getItem('debug_assist_token');
      if (!token) {
        window.location.replace('/dashboard/login.html');
        return;
      }

      try {
        const res = await fetch(`${API}/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          localStorage.removeItem('debug_assist_token');
          window.location.replace('/dashboard/login.html');
          return;
        }

        if (!res.ok) return;

        userData = await res.json();
        document.getElementById('user-email').textContent = userData.email;
        document.getElementById('account-email').textContent = userData.email;
      } catch (_) {}

      loadAnalytics(token);
    }

    async function loadAnalytics(token) {
      const area = document.getElementById('chart-area');
      try {
        const res = await fetch(`${API}/v1/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          area.innerHTML = '<div class="chart-error">Não foi possível carregar o gráfico</div>';
          return;
        }

        const { dados } = await res.json();

        if (!dados || dados.length === 0) {
          area.innerHTML = '<div class="chart-empty">Nenhuma chamada nos últimos 30 dias</div>';
          return;
        }

        renderChart(dados);
      } catch (_) {
        area.innerHTML = '<div class="chart-error">Não foi possível carregar o gráfico</div>';
      }
    }

    function renderChart(dados) {
      const W = 600, H = 160, PADDING_LEFT = 28, PADDING_BOTTOM = 20, PADDING_TOP = 10;
      const chartW = W - PADDING_LEFT;
      const chartH = H - PADDING_BOTTOM - PADDING_TOP;

      const maxTotal = Math.max(...dados.map(d => d.total), 1);
      const barCount = dados.length;
      const barWidth = Math.max(4, Math.floor((chartW / barCount) * 0.7));
      const gap = Math.floor(chartW / barCount);

      // Y grid lines at 25%, 50%, 75%, 100%
      const gridValues = [
        Math.ceil(maxTotal * 0.25),
        Math.ceil(maxTotal * 0.5),
        Math.ceil(maxTotal * 0.75),
        maxTotal,
      ].filter((v, i, a) => a.indexOf(v) === i);

      let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" style="min-width:300px;">`;

      // Grid lines
      for (const val of gridValues) {
        const y = PADDING_TOP + chartH - Math.round((val / maxTotal) * chartH);
        svg += `<line x1="${PADDING_LEFT}" y1="${y}" x2="${W}" y2="${y}" stroke="#222" stroke-width="1" stroke-dasharray="3,3"/>`;
        svg += `<text x="${PADDING_LEFT - 4}" y="${y + 3}" font-size="8" fill="#555" text-anchor="end">${val}</text>`;
      }

      // Axis
      svg += `<line x1="${PADDING_LEFT}" y1="${PADDING_TOP + chartH}" x2="${W}" y2="${PADDING_TOP + chartH}" stroke="#333" stroke-width="1"/>`;

      // Bars
      dados.forEach((d, i) => {
        const barH = Math.max(2, Math.round((d.total / maxTotal) * chartH));
        const x = PADDING_LEFT + i * gap + Math.floor((gap - barWidth) / 2);
        const y = PADDING_TOP + chartH - barH;
        svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="#6366f1" opacity="0.8" rx="2"
          data-date="${d.data}" data-total="${d.total}"
          onmouseenter="showTooltip(event, '${formatDate(d.data)}', ${d.total})"
          onmouseleave="hideTooltip()"
          style="cursor:default"/>`;

        // X label every 5 bars
        if (i % 5 === 0) {
          svg += `<text x="${x + barWidth / 2}" y="${H - 4}" font-size="8" fill="#555" text-anchor="middle">${formatDate(d.data, true)}</text>`;
        }
      });

      svg += `</svg>`;
      document.getElementById('chart-area').innerHTML = svg;
    }

    function formatDate(iso, short = false) {
      const [, m, d] = iso.split('-');
      const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
      return short ? `${parseInt(d)}/${months[parseInt(m)-1]}` : `${parseInt(d)} ${months[parseInt(m)-1]}`;
    }

    function showTooltip(event, date, total) {
      const tip = document.getElementById('chart-tooltip');
      tip.textContent = `${date} — ${total} chamada${total !== 1 ? 's' : ''}`;
      tip.style.display = 'block';
      tip.style.left = (event.clientX + 12) + 'px';
      tip.style.top = (event.clientY - 28) + 'px';
    }

    function hideTooltip() {
      document.getElementById('chart-tooltip').style.display = 'none';
    }

    // API Key
    function toggleReveal() {
      if (!userData) return;
      revealed = !revealed;
      document.getElementById('apikey-field').textContent =
        revealed ? userData.api_key : '••••••••-••••-••••-••••-••••••••••••';
      document.getElementById('btn-reveal').textContent = revealed ? '🙈 Ocultar' : '👁 Revelar';
    }

    function copyKey() {
      if (!userData) return;
      navigator.clipboard.writeText(userData.api_key).then(() => {
        const fb = document.getElementById('copied-feedback');
        fb.style.display = 'block';
        setTimeout(() => { fb.style.display = 'none'; }, 2000);
      });
    }

    // Modal
    function openModal() {
      document.getElementById('modal-overlay').classList.add('active');
      document.getElementById('regen-error').style.display = 'none';
      document.getElementById('regen-success').style.display = 'none';
    }

    function closeModal() {
      document.getElementById('modal-overlay').classList.remove('active');
    }

    async function confirmRegenerate() {
      const token = localStorage.getItem('debug_assist_token');
      const btn = document.getElementById('btn-confirm');
      btn.disabled = true;
      btn.textContent = 'Gerando...';

      try {
        const res = await fetch(`${API}/v1/auth/regenerate-key`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });

        closeModal();

        if (!res.ok) {
          const err = document.getElementById('regen-error');
          err.textContent = 'Erro ao gerar nova key. Tente novamente.';
          err.style.display = 'block';
          return;
        }

        const { api_key } = await res.json();
        userData.api_key = api_key;
        revealed = true;
        document.getElementById('apikey-field').textContent = api_key;
        document.getElementById('btn-reveal').textContent = '🙈 Ocultar';
        document.getElementById('regen-success').style.display = 'block';
        setTimeout(() => { document.getElementById('regen-success').style.display = 'none'; }, 4000);
      } catch (_) {
        closeModal();
        const err = document.getElementById('regen-error');
        err.textContent = 'Erro de conexão. Tente novamente.';
        err.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Sim, gerar nova';
      }
    }

    // Sair
    document.getElementById('btn-sair').addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('debug_assist_token');
      window.location.replace('/dashboard/login.html');
    });

    // Fechar modal clicando fora
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-overlay')) closeModal();
    });

    init();
  </script>
</body>
</html>
```

- [ ] **Step 2: Verificar que a página é servida corretamente**

```bash
# Sobe o servidor localmente
node src/server.js &
# Aguarda 1 segundo
sleep 1
# Verifica que o arquivo é servido (deve retornar 200)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard/configuracoes.html
# Mata o servidor
kill %1
```

Esperado: `200`

- [ ] **Step 3: Commit**

```bash
git add public/dashboard/configuracoes.html
git commit -m "feat(dashboard): criar página Configurações com API Key e analytics"
```

---

### Task 5: Adicionar link Configurações na sidebar

**Files:**
- Modify: `public/dashboard/index.html`
- Modify: `public/dashboard/historico.html`
- Modify: `public/dashboard/alertas.html`

> **Nota:** `pricing.html` não tem sidebar — é uma página standalone. Não precisa ser alterada.

- [ ] **Step 1: Atualizar `public/dashboard/index.html`**

Localizar o bloco:
```html
      <a class="nav-item" href="/dashboard/alertas.html" id="nav-alertas">🔔 Alertas<span class="nav-badge" id="alert-badge"></span></a>
      <a class="nav-item" href="https://debug-assist.onrender.com/docs" target="_blank" rel="noopener">📖 Docs</a>
```

Substituir por:
```html
      <a class="nav-item" href="/dashboard/alertas.html" id="nav-alertas">🔔 Alertas<span class="nav-badge" id="alert-badge"></span></a>
      <a class="nav-item" href="/dashboard/configuracoes.html">⚙️ Configurações</a>
      <a class="nav-item" href="https://debug-assist.onrender.com/docs" target="_blank" rel="noopener">📖 Docs</a>
```

- [ ] **Step 2: Atualizar `public/dashboard/historico.html`**

Localizar o bloco:
```html
      <a class="nav-item" href="/dashboard/alertas.html" id="nav-alertas">🔔 Alertas<span class="nav-badge" id="alert-badge"></span></a>
      <a class="nav-item" href="https://debug-assist.onrender.com/docs" target="_blank" rel="noopener">📖 Docs</a>
```

Substituir por:
```html
      <a class="nav-item" href="/dashboard/alertas.html" id="nav-alertas">🔔 Alertas<span class="nav-badge" id="alert-badge"></span></a>
      <a class="nav-item" href="/dashboard/configuracoes.html">⚙️ Configurações</a>
      <a class="nav-item" href="https://debug-assist.onrender.com/docs" target="_blank" rel="noopener">📖 Docs</a>
```

- [ ] **Step 3: Atualizar `public/dashboard/alertas.html`**

Nesta página o link de Alertas não tem `id` nem `<span>` — o padrão é diferente. Localizar:
```html
      <a class="nav-item active" href="/dashboard/alertas.html">🔔 Alertas</a>
      <a class="nav-item" href="https://debug-assist.onrender.com/docs" target="_blank" rel="noopener">📖 Docs</a>
```

Substituir por:
```html
      <a class="nav-item active" href="/dashboard/alertas.html">🔔 Alertas</a>
      <a class="nav-item" href="/dashboard/configuracoes.html">⚙️ Configurações</a>
      <a class="nav-item" href="https://debug-assist.onrender.com/docs" target="_blank" rel="noopener">📖 Docs</a>
```

- [ ] **Step 4: Commit final**

```bash
git add public/dashboard/index.html public/dashboard/historico.html public/dashboard/alertas.html
git commit -m "feat(dashboard): adicionar link Configurações na sidebar de todas as páginas"
```

---

## Verificação Final

- [ ] Rodar a suite completa:

```bash
npx jest --no-coverage
```

Esperado: PASS em todos os arquivos

- [ ] Confirmar endpoints no servidor local (requer Supabase configurado em `.env`):

```bash
node src/server.js &
sleep 1
curl -s http://localhost:3000/v1/analytics -H "Authorization: Bearer SEU_TOKEN"
curl -s -X POST http://localhost:3000/v1/auth/regenerate-key -H "Authorization: Bearer SEU_TOKEN"
kill %1
```
