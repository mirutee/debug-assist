# Diagnostics History & SDK Auto-Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time diagnostics history to the dashboard and auto-capture runtime errors via the DevInsight SDK.

**Architecture:** The `diagnosticos` table gains a `usuario_id` column; `POST /v1/diagnosticos` saves it from the API key auth context; a new `GET /v1/diagnosticos/historico` endpoint (JWT-authenticated) returns a user's history; the dashboard `historico.html` polls every 5s and renders an expandable list; `sdk/index.js` gains a static `DevInsight.init()` method that registers `uncaughtException`/`unhandledRejection` handlers to auto-send diagnostics.

**Tech Stack:** Node.js/Express, Supabase (MCP for migration), vanilla JS, Jest/Supertest.

**Spec:** `docs/superpowers/specs/2026-03-23-diagnostics-history-design.md`

---

## Files

**Notes:**
- `sdk/package.json` already exists at `sdk/package.json` — no need to create it.
- `.error-msg.show { display: block; }` is already in `style.css` line 74 — the fetch error div will render correctly.
- The `getUserFromToken` mock pattern in Task 3 matches `billing.test.js` exactly — import it from the mock and call `.mockResolvedValue()` in the helper function.

---

## Files

| Action | File |
|---|---|
| Migration | Supabase `diagnosticos` table (via MCP) |
| Modify | `src/db/supabase.js` |
| Modify | `src/routes/diagnosticos.js` |
| Create | `public/dashboard/historico.html` |
| Modify | `public/dashboard/index.html` |
| Modify | `public/dashboard/style.css` |
| Modify | `sdk/index.js` |
| Modify | `tests/db/supabase.test.js` |
| Modify | `tests/routes/diagnosticos.test.js` |
| Modify | `tests/sdk/sdk.test.js` |

---

### Task 1: DB Migration — add `usuario_id` to `diagnosticos`

**Files:**
- Supabase migration (applied via MCP tool `mcp__supabase__apply_migration`)

No unit test for this task — verify by querying the table after migration.

- [ ] **Step 1: Apply the migration**

Use the `mcp__supabase__apply_migration` MCP tool with project ID from `mcp__supabase__list_projects`. Migration name: `add_usuario_id_to_diagnosticos`. SQL:

```sql
ALTER TABLE public.diagnosticos
  ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES public.usuarios(id);

CREATE INDEX IF NOT EXISTS idx_diagnosticos_usuario_id_criado_em
  ON public.diagnosticos (usuario_id, criado_em DESC);
```

- [ ] **Step 2: Verify the column exists**

Use `mcp__supabase__execute_sql`:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'diagnosticos'
ORDER BY ordinal_position;
```

Expected: `usuario_id` column of type `uuid`, nullable `YES`.

---

### Task 2: Backend DB layer — `saveDiagnostico` + `getDiagnosticosByUsuario`

**Files:**
- Modify: `src/db/supabase.js`
- Test: `tests/db/supabase.test.js`

**Context:** `supabase.js` exports `saveDiagnostico`, `getUsuarioByApiKey`, `getUsuarioByAuthId`, etc. Tests use a `mockSupabaseClient` that mocks `@supabase/supabase-js`. Pattern: chain `.from().select().eq()...` returning mock objects. `getDiagnosticosByUsuario` is new and needs to be exported. `saveDiagnostico` currently does not accept `usuario_id` — update its signature and insert.

- [ ] **Step 1: Write 3 failing tests in `tests/db/supabase.test.js`**

Add at the end of the file (before the last `}`), inside a new describe block:

```js
describe("getDiagnosticosByUsuario", () => {
  it("retorna diagnósticos do usuário sem filtro after", async () => {
    const fakeDiagnosticos = [
      { id: "d1", tipo: "silent_backend_error", criado_em: "2026-03-23T10:00:00Z", resposta: {}, mensagem: "err", contexto: {} },
    ];

    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: fakeDiagnosticos, error: null }),
          }),
        }),
      }),
    });

    const { getDiagnosticosByUsuario } = require("../../src/db/supabase");
    const result = await getDiagnosticosByUsuario("user-uuid");
    expect(result).toEqual(fakeDiagnosticos);
  });

  it("aplica filtro gt quando after é fornecido", async () => {
    // When `after` is provided, getDiagnosticosByUsuario calls query.gt("criado_em", after)
    // The Supabase chain is: from → select → eq → order → limit → gt (when after present)
    const mockGt = jest.fn().mockResolvedValue({ data: [], error: null });
    const mockLimitWithAfter = jest.fn().mockReturnValue({ gt: mockGt });
    const mockOrderWithAfter = jest.fn().mockReturnValue({ limit: mockLimitWithAfter });
    const mockEqWithAfter = jest.fn().mockReturnValue({ order: mockOrderWithAfter });
    const mockSelectWithAfter = jest.fn().mockReturnValue({ eq: mockEqWithAfter });
    mockSupabaseClient.from.mockReturnValue({ select: mockSelectWithAfter });

    const { getDiagnosticosByUsuario } = require("../../src/db/supabase");
    await getDiagnosticosByUsuario("user-uuid", { after: "2026-03-23T10:00:00Z" });
    expect(mockGt).toHaveBeenCalledWith("criado_em", "2026-03-23T10:00:00Z");
  });

  it("lança erro quando Supabase retorna erro", async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: null, error: { message: "db error" } }),
          }),
        }),
      }),
    });

    const { getDiagnosticosByUsuario } = require("../../src/db/supabase");
    await expect(getDiagnosticosByUsuario("user-uuid")).rejects.toThrow();
  });
});

describe("saveDiagnostico com usuario_id", () => {
  it("passa usuario_id para o insert", async () => {
    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    mockSupabaseClient.from.mockReturnValue({ insert: mockInsert });

    const { saveDiagnostico } = require("../../src/db/supabase");
    await saveDiagnostico({ tipo: "silent_backend_error", mensagem: "err", contexto: {}, resposta: {}, usuario_id: "user-uuid" });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ usuario_id: "user-uuid" })
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/db/supabase.test.js
```

Expected: 4 new tests FAIL with "getDiagnosticosByUsuario is not a function" or similar.

- [ ] **Step 3: Implement changes in `src/db/supabase.js`**

**3a — Modify `saveDiagnostico`** to accept `usuario_id`:

```js
async function saveDiagnostico({ tipo, mensagem, contexto, resposta, usuario_id }) {
  const { error } = await supabase
    .from("diagnosticos")
    .insert({ tipo, mensagem, contexto, resposta, usuario_id: usuario_id || null });

  if (error) {
    console.error("Erro ao salvar diagnóstico no Supabase:", error.message);
  }
}
```

**3b — Add `getDiagnosticosByUsuario`** after `saveDiagnostico`:

```js
async function getDiagnosticosByUsuario(usuarioId, { after } = {}) {
  let query = supabase
    .from("diagnosticos")
    .select("id, tipo, criado_em, resposta, mensagem, contexto")
    .eq("usuario_id", usuarioId)
    .order("criado_em", { ascending: false })
    .limit(50);

  if (after) query = query.gt("criado_em", after);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
```

**3c — Export `getDiagnosticosByUsuario`** in the `module.exports` at the bottom of `supabase.js`:

```js
module.exports = {
  saveDiagnostico,
  getUsuarioByApiKey,
  getUserFromToken,
  getUsuarioByAuthId,
  getUsuarioById,
  updatePlanoBilling,
  getUsuarioByStripeCustomerId,
  getDiagnosticosByUsuario,
  incrementarUso,
};
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/db/supabase.test.js
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/supabase.js tests/db/supabase.test.js
git commit -m "feat: adicionar getDiagnosticosByUsuario e usuario_id em saveDiagnostico"
```

---

### Task 3: Backend routes — `POST /` passes `usuario_id` + `GET /historico`

**Files:**
- Modify: `src/routes/diagnosticos.js`
- Test: `tests/routes/diagnosticos.test.js`

**Context:** `diagnosticos.js` currently calls `saveDiagnostico` without `usuario_id`. `req.usuario.id` is available from `auth` middleware (API key). The `GET /historico` route uses `authJwt` (from `../middleware/authJwt`), not `auth`. The mock in `diagnosticos.test.js` already mocks `getUsuarioByAuthId` (needed for `authJwt`). Add `getDiagnosticosByUsuario` to the mock. The test for `GET /historico` needs JWT auth — use `getUserFromToken` + `getUsuarioByAuthId` mock pattern (same as `billing.test.js`).

- [ ] **Step 1: Write failing tests in `tests/routes/diagnosticos.test.js`**

**1a** — Add `getDiagnosticosByUsuario` and `getUserFromToken` to the top-level mock:

```js
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
  getUserFromToken: jest.fn(),
  getDiagnosticosByUsuario: jest.fn(),
}));
```

**1b** — Add these imports after the existing `require` lines:

```js
const { saveDiagnostico, getUsuarioByAuthId, getUserFromToken, getDiagnosticosByUsuario } = require("../../src/db/supabase");
```

**1c** — Add a new describe block at the end of the file:

```js
// --- historico ---

describe("GET /v1/diagnosticos/historico", () => {
  function mockJwtDiagnosticos() {
    getUserFromToken.mockResolvedValue({ data: { user: { id: "auth-uuid" } }, error: null });
    getUsuarioByAuthId.mockResolvedValue({ id: "user-test-uuid", email: "u@test.com", plano_id: "free", stripe_customer_id: null });
  }

  beforeEach(() => jest.clearAllMocks());

  it("retorna 401 sem token", async () => {
    const res = await request(app).get("/v1/diagnosticos/historico");
    expect(res.status).toBe(401);
  });

  it("retorna lista de diagnósticos para usuário autenticado", async () => {
    mockJwtDiagnosticos();
    getDiagnosticosByUsuario.mockResolvedValue([
      { id: "d1", tipo: "silent_backend_error", criado_em: "2026-03-23T10:00:00Z", resposta: { problema: "Erro", nivel: "alto" }, mensagem: "err", contexto: {} },
    ]);

    const res = await request(app)
      .get("/v1/diagnosticos/historico")
      .set("Authorization", "Bearer jwt-valido");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].id).toBe("d1");
  });

  it("passa parâmetro after quando fornecido", async () => {
    mockJwtDiagnosticos();
    getDiagnosticosByUsuario.mockResolvedValue([]);

    await request(app)
      .get("/v1/diagnosticos/historico?after=2026-03-23T10:00:00Z")
      .set("Authorization", "Bearer jwt-valido");

    expect(getDiagnosticosByUsuario).toHaveBeenCalledWith(
      "user-test-uuid",
      { after: "2026-03-23T10:00:00Z" }
    );
  });

  it("retorna 500 quando getDiagnosticosByUsuario lança erro", async () => {
    mockJwtDiagnosticos();
    getDiagnosticosByUsuario.mockRejectedValue(new Error("db down"));

    const res = await request(app)
      .get("/v1/diagnosticos/historico")
      .set("Authorization", "Bearer jwt-valido");

    expect(res.status).toBe(500);
    expect(res.body.erro).toBeDefined();
  });
});

describe("POST /v1/diagnosticos salva usuario_id", () => {
  it("chama saveDiagnostico com usuario_id do token", async () => {
    const res = await request(app)
      .post("/v1/diagnosticos")
      .set(HEADERS)
      .send({ tipo: "hydration_error", mensagem: "Hydration failed" });

    expect(res.status).toBe(200);
    expect(saveDiagnostico).toHaveBeenCalledWith(
      expect.objectContaining({ usuario_id: "user-test-uuid" })
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/routes/diagnosticos.test.js
```

Expected: 5 new tests FAIL (historico route doesn't exist, `usuario_id` not passed).

- [ ] **Step 3: Implement changes in `src/routes/diagnosticos.js`**

Replace the entire file content:

```js
// src/routes/diagnosticos.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const authJwt = require("../middleware/authJwt");
const validate = require("../middleware/validate");
const diagnosticar = require("../engines/index");
const { saveDiagnostico, incrementarUso, getDiagnosticosByUsuario } = require("../db/supabase");

router.post("/", auth, validate, async (req, res) => {
  try {
    const resultado = diagnosticar(req.body);

    // Persiste de forma assíncrona — não bloqueia a resposta
    saveDiagnostico({
      tipo: req.body.tipo,
      mensagem: req.body.mensagem,
      contexto: req.body.contexto,
      resposta: resultado,
      usuario_id: req.usuario.id,
    }).catch(() => {});

    // Incrementa cota após resposta bem-sucedida
    res.on("finish", () => {
      if (res.statusCode === 200) {
        incrementarUso(req.usuario.id).catch(() => {});
      }
    });

    return res.json(resultado);
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno ao processar diagnóstico" });
  }
});

router.get("/historico", authJwt, async (req, res) => {
  try {
    const { after } = req.query;
    const items = await getDiagnosticosByUsuario(req.usuario.id, { after });
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ erro: "Erro ao buscar histórico" });
  }
});

module.exports = router;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/routes/diagnosticos.test.js
```

Expected: all tests PASS.

- [ ] **Step 5: Run full suite to confirm nothing broke**

```bash
npm test
```

Expected: all suites PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/diagnosticos.js tests/routes/diagnosticos.test.js
git commit -m "feat: passar usuario_id ao salvar diagnóstico e adicionar GET /historico"
```

---

### Task 4: Frontend — `historico.html`, nav link, styles

**Files:**
- Create: `public/dashboard/historico.html`
- Modify: `public/dashboard/index.html` (add nav link)
- Modify: `public/dashboard/style.css` (add history styles)

**Context:** `index.html` has a `<nav class="sidebar">` with `.nav-item` links. Add `<a class="nav-item" href="/dashboard/historico.html">📋 Histórico</a>` after "Visão Geral". The `historico.html` follows the exact same layout. `style.css` needs classes for the history list, expandable rows, severity badges.

No unit tests for this task — verify manually in browser.

- [ ] **Step 1: Add styles to `public/dashboard/style.css`**

Append at the end of `style.css`:

```css
/* ── Historico ──────────────────────────── */
.history-list { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }

.history-item {
  background: #111;
  border: 1px solid #222;
  border-radius: 10px;
  overflow: hidden;
}

.history-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  cursor: pointer;
  transition: background 0.1s;
}
.history-header:hover { background: #161616; }

.severity-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 3px 8px;
  border-radius: 4px;
  white-space: nowrap;
}
.nivel-baixo  { background: #14532d; color: #4ade80; }
.nivel-médio  { background: #713f12; color: #fbbf24; }
.nivel-alto   { background: #7f1d1d; color: #f87171; }

.history-tipo {
  font-size: 11px;
  color: #555;
  font-family: 'Courier New', monospace;
  white-space: nowrap;
}

.history-problema {
  flex: 1;
  font-size: 13px;
  color: #ccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-time {
  font-size: 11px;
  color: #444;
  white-space: nowrap;
}

.history-detail {
  padding: 0 18px 16px;
  border-top: 1px solid #1a1a1a;
  display: none;
  flex-direction: column;
  gap: 12px;
}
.history-detail.open { display: flex; }

.detail-row { font-size: 13px; color: #aaa; line-height: 1.6; }
.detail-row strong { color: #fff; }

.detail-sugestoes { padding-left: 16px; }
.detail-sugestoes li { font-size: 12px; color: #888; margin-bottom: 4px; }

.detail-code {
  background: #0d0d0d;
  border: 1px solid #222;
  border-radius: 6px;
  padding: 10px 14px;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  color: #4ade80;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 160px;
  overflow-y: auto;
}

.confianca-bar-wrap { display: flex; align-items: center; gap: 10px; }
.confianca-bar {
  flex: 1;
  background: #222;
  border-radius: 4px;
  height: 4px;
}
.confianca-fill { background: #6366f1; height: 4px; border-radius: 4px; }

.history-empty {
  text-align: center;
  padding: 60px 20px;
  color: #444;
  font-size: 14px;
  line-height: 1.8;
}
.history-empty a { color: #6366f1; text-decoration: none; }
```

- [ ] **Step 2: Add "Histórico" nav link in `public/dashboard/index.html`**

Find the sidebar nav item for "Visão Geral":
```html
<a class="nav-item active">🏠 Visão Geral</a>
```

Add after it:
```html
<a class="nav-item" href="/dashboard/historico.html">📋 Histórico</a>
```

- [ ] **Step 3: Create `public/dashboard/historico.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Histórico — DevInsight</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="dashboard">
    <nav class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-dot"></div>
        <span class="logo-text">DevInsight</span>
      </div>
      <a class="nav-item" href="/dashboard/">🏠 Visão Geral</a>
      <a class="nav-item active" href="/dashboard/historico.html">📋 Histórico</a>
      <a class="nav-item" href="https://devinsight-api.onrender.com/docs" target="_blank" rel="noopener">📖 Docs</a>
      <a class="nav-item" id="btn-sair" href="#">🚪 Sair</a>
      <div class="sidebar-footer" id="user-email">Carregando...</div>
    </nav>

    <main class="main">
      <div class="page-title">Histórico de Diagnósticos</div>
      <div class="page-subtitle" id="page-subtitle">Erros capturados automaticamente pelo SDK e via API</div>

      <div class="error-msg" id="fetch-error" style="margin-bottom:16px;"></div>

      <div class="history-list" id="history-list">
        <div class="history-empty" id="empty-state" style="display:none;">
          Nenhum diagnóstico ainda.<br>
          <a href="https://devinsight-api.onrender.com/docs" target="_blank">Integre o SDK no seu projeto →</a>
        </div>
      </div>
    </main>
  </div>

  <script>
    const API = '';
    let mostRecentCriadoEm = null;
    let pollInterval = null;

    async function init() {
      const token = localStorage.getItem('devinsight_token');
      if (!token) {
        window.location.replace('/dashboard/login.html');
        return;
      }

      document.getElementById('btn-sair').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('devinsight_token');
        window.location.replace('/dashboard/login.html');
      });

      await loadHistory(token);
      pollInterval = setInterval(() => poll(token), 5000);
    }

    async function loadHistory(token) {
      try {
        const res = await fetch(`${API}/v1/diagnosticos/historico`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          localStorage.removeItem('devinsight_token');
          window.location.replace('/dashboard/login.html');
          return;
        }

        if (!res.ok) {
          showError('Erro ao carregar histórico. Tente recarregar.');
          return;
        }

        const items = await res.json();
        renderItems(items, false);

        if (items.length > 0) {
          mostRecentCriadoEm = items[0].criado_em;
        }

        document.getElementById('user-email').textContent =
          localStorage.getItem('devinsight_email') || '';

        if (items.length === 0) {
          document.getElementById('empty-state').style.display = 'block';
        }
      } catch (err) {
        showError('Erro de conexão. Verifique sua internet.');
      }
    }

    async function poll(token) {
      if (!mostRecentCriadoEm) return;

      try {
        const res = await fetch(
          `${API}/v1/diagnosticos/historico?after=${encodeURIComponent(mostRecentCriadoEm)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!res.ok) return;

        const items = await res.json();
        if (items.length === 0) return;

        renderItems(items, true);
        mostRecentCriadoEm = items[0].criado_em;

        document.getElementById('empty-state').style.display = 'none';
      } catch (err) {
        // Silent — retry on next interval
      }
    }

    function renderItems(items, prepend) {
      const list = document.getElementById('history-list');
      const emptyState = document.getElementById('empty-state');

      items.forEach(item => {
        const el = buildItem(item);
        if (prepend) {
          list.insertBefore(el, list.firstChild);
        } else {
          list.appendChild(el);
        }
      });
    }

    function buildItem(item) {
      const resposta = item.resposta || {};
      const nivel = resposta.nivel || 'baixo';
      const problema = resposta.problema || '—';
      const causa = resposta.causa || '—';
      const sugestoes = resposta.sugestoes || [];
      const confianca = resposta.confianca != null ? Math.round(resposta.confianca * 100) : null;

      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <div class="history-header" onclick="toggleDetail(this)">
          <span class="severity-badge nivel-${nivel}">${nivel}</span>
          <span class="history-tipo">${escHtml(item.tipo)}</span>
          <span class="history-problema">${escHtml(problema)}</span>
          <span class="history-time">${formatDate(item.criado_em)}</span>
        </div>
        <div class="history-detail">
          <div class="detail-row"><strong>Causa:</strong> ${escHtml(causa)}</div>
          ${sugestoes.length > 0 ? `
          <div class="detail-row">
            <strong>Sugestões:</strong>
            <ul class="detail-sugestoes">
              ${sugestoes.map(s => `<li>${escHtml(s)}</li>`).join('')}
            </ul>
          </div>` : ''}
          ${confianca != null ? `
          <div class="detail-row">
            <strong>Confiança:</strong> ${confianca}%
            <div class="confianca-bar-wrap">
              <div class="confianca-bar"><div class="confianca-fill" style="width:${confianca}%"></div></div>
            </div>
          </div>` : ''}
          ${item.mensagem ? `<div class="detail-row"><strong>Mensagem:</strong> ${escHtml(item.mensagem)}</div>` : ''}
          ${item.contexto && Object.keys(item.contexto).length > 0 ? `
          <div class="detail-row">
            <strong>Contexto:</strong>
            <pre class="detail-code">${escHtml(JSON.stringify(item.contexto, null, 2))}</pre>
          </div>` : ''}
        </div>
      `;
      return div;
    }

    function toggleDetail(header) {
      const detail = header.nextElementSibling;
      detail.classList.toggle('open');
    }

    function formatDate(iso) {
      if (!iso) return '—';
      const d = new Date(iso);
      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    function escHtml(str) {
      if (typeof str !== 'string') return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function showError(msg) {
      const el = document.getElementById('fetch-error');
      el.textContent = msg;
      el.classList.add('show');
    }

    init();
  </script>
</body>
</html>
```

- [ ] **Step 4: Run full test suite to confirm nothing broke**

```bash
npm test
```

Expected: all suites PASS.

- [ ] **Step 5: Commit**

```bash
git add public/dashboard/historico.html public/dashboard/index.html public/dashboard/style.css
git commit -m "feat: adicionar página de histórico de diagnósticos no dashboard"
```

---

### Task 5: SDK — `DevInsight.init()` auto-capture

**Files:**
- Modify: `sdk/index.js`
- Test: `tests/sdk/sdk.test.js`

**Context:** `sdk/index.js` exports a `DevInsight` class with a `report()` instance method. Add a static `init({ apiKey, projectName, baseUrl })` method that creates an internal instance and registers `process.on('uncaughtException')` and `process.on('unhandledRejection')`. On trigger: sends diagnostic silently (ignores errors), then exits (`process.exit(1)` for `uncaughtException` to preserve crash behavior; for `unhandledRejection` just sends silently). Guard: if `init` already called, don't register again (use a module-level `_initialized` flag).

- [ ] **Step 1: Write failing tests in `tests/sdk/sdk.test.js`**

Add at the end of the file:

```js
describe("DevInsight.init() auto-capture", () => {
  let originalListeners;

  beforeEach(() => {
    // Save and remove existing listeners to avoid interference
    originalListeners = {
      uncaughtException: process.listeners('uncaughtException').slice(),
      unhandledRejection: process.listeners('unhandledRejection').slice(),
    };
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');

    // Reset the initialized flag between tests
    DevInsight._initialized = false;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  afterEach(() => {
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    originalListeners.uncaughtException.forEach(l => process.on('uncaughtException', l));
    originalListeners.unhandledRejection.forEach(l => process.on('unhandledRejection', l));
    DevInsight._initialized = false;
  });

  it("registra listener de uncaughtException ao chamar init()", () => {
    DevInsight.init({ apiKey: 'test-key' });
    expect(process.listenerCount('uncaughtException')).toBe(1);
  });

  it("registra listener de unhandledRejection ao chamar init()", () => {
    DevInsight.init({ apiKey: 'test-key' });
    expect(process.listenerCount('unhandledRejection')).toBe(1);
  });

  it("não registra listeners duplicados se init() chamado duas vezes", () => {
    DevInsight.init({ apiKey: 'test-key' });
    DevInsight.init({ apiKey: 'test-key' });
    expect(process.listenerCount('uncaughtException')).toBe(1);
    expect(process.listenerCount('unhandledRejection')).toBe(1);
  });

  it("envia diagnóstico silent_backend_error ao capturar uncaughtException", async () => {
    DevInsight.init({ apiKey: 'test-key', projectName: 'meu-projeto' });

    const err = new Error('test crash');
    // Emit uncaughtException but prevent actual process exit
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    process.emit('uncaughtException', err);

    // Wait for async send
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/diagnosticos'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      })
    );
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.tipo).toBe('silent_backend_error');
    expect(body.mensagem).toBe('test crash');
    expect(body.contexto.projectName).toBe('meu-projeto');

    mockExit.mockRestore();
  });

  it("não lança erro se o envio do diagnóstico falhar", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
    DevInsight.init({ apiKey: 'test-key' });

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    expect(() => process.emit('uncaughtException', new Error('crash'))).not.toThrow();

    await new Promise(resolve => setTimeout(resolve, 50));
    mockExit.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- tests/sdk/sdk.test.js
```

Expected: 5 new tests FAIL — `DevInsight.init is not a function` or `DevInsight._initialized` is undefined.

- [ ] **Step 3: Implement `DevInsight.init()` in `sdk/index.js`**

Replace the entire file:

```js
// sdk/index.js
const DEFAULT_BASE_URL = 'https://devinsight-api.onrender.com';

class DevInsight {
  constructor({ apiKey, baseUrl } = {}) {
    if (!apiKey) throw new Error('DevInsight: apiKey é obrigatória');
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || DEFAULT_BASE_URL;
  }

  async report({ tipo, mensagem, contexto, dados } = {}) {
    if (!tipo) throw new Error("DevInsight: campo 'tipo' é obrigatório");

    const response = await fetch(`${this.baseUrl}/v1/diagnosticos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ tipo, mensagem, contexto, dados }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`DevInsight API error ${response.status}: ${err.erro || 'desconhecido'}`);
    }

    return response.json();
  }

  static init({ apiKey, projectName = 'unknown', baseUrl } = {}) {
    if (DevInsight._initialized) return;
    DevInsight._initialized = true;

    const client = new DevInsight({ apiKey, baseUrl });

    async function sendSilently(err) {
      try {
        await client.report({
          tipo: 'silent_backend_error',
          mensagem: err && err.message ? err.message : String(err),
          contexto: { projectName, stack: err && err.stack ? err.stack : undefined },
        });
      } catch (_) {
        // Never throw — capturing errors must not cause new errors
      }
    }

    process.on('uncaughtException', async (err) => {
      await sendSilently(err);
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      await sendSilently(reason instanceof Error ? reason : new Error(String(reason)));
    });
  }
}

DevInsight._initialized = false;

module.exports = DevInsight;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- tests/sdk/sdk.test.js
```

Expected: all tests PASS.

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: all suites PASS.

- [ ] **Step 6: Commit**

```bash
git add sdk/index.js tests/sdk/sdk.test.js
git commit -m "feat: adicionar DevInsight.init() para auto-captura de erros em runtime"
```

---

### Task 6: Push & deploy

- [ ] **Step 1: Push to origin**

```bash
git push origin master
```

Render fará deploy automático. Aguardar ~2 minutos.

- [ ] **Step 2: Verificar manualmente**

1. Abrir `https://devinsight-api.onrender.com/dashboard/`
2. Confirmar que "📋 Histórico" aparece na sidebar
3. Clicar em Histórico — deve abrir `historico.html` sem erros
4. Testar com a API key: enviar um diagnóstico via `POST /v1/diagnosticos` e confirmar que aparece na página em até 5s
