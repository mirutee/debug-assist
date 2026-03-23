# Diagnostics History & SDK Auto-Capture — Design Spec

**Date:** 2026-03-23
**Status:** Approved

---

## Goal

Give developers a real-time view of all diagnostics their applications have sent to the DevInsight API. Pair this with an npm SDK that automatically captures runtime errors (uncaught exceptions, unhandled rejections) and sends them without requiring manual API calls.

---

## Architecture Overview

```
[Dev's app + devinsight SDK]
    → captures uncaughtException / unhandledRejection
    → POST /v1/diagnosticos (with API Key)
    → saves usuario_id in diagnosticos table

[Dashboard historico.html]
    → GET /v1/diagnosticos/historico (with JWT)
    → polls every 5s for new entries
    → displays expandable list with full detail panel
```

The `diagnosticos` route already uses `auth` middleware (API key), which resolves `req.usuario.id` to the internal `usuarios.id`. The historico route uses `authJwt` (JWT), also resolving `req.usuario.id`. Both middlewares produce the same `id` field — no translation needed.

---

## Components

### 1. Database — `diagnosticos` table migration

Add `usuario_id` column (nullable `uuid`, FK to `usuarios.id`):

```sql
ALTER TABLE public.diagnosticos
  ADD COLUMN usuario_id uuid REFERENCES public.usuarios(id);

CREATE INDEX idx_diagnosticos_usuario_id_criado_em
  ON public.diagnosticos (usuario_id, criado_em DESC);
```

Nullable so existing rows (sent before this feature) and anonymous API calls remain valid.

---

### 2. Backend — `src/db/supabase.js`

**Modify `saveDiagnostico`** to accept and persist `usuario_id`:

```js
async function saveDiagnostico({ tipo, mensagem, contexto, resposta, usuario_id }) {
  const { error } = await supabase
    .from("diagnosticos")
    .insert({ tipo, mensagem, contexto, resposta, usuario_id: usuario_id || null });
  if (error) console.error("Erro ao salvar diagnóstico:", error.message);
}
```

**Add `getDiagnosticosByUsuario`**:

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
  return data;
}
```

---

### 3. Backend — `src/routes/diagnosticos.js`

**Modify `POST /`** to pass `usuario_id` to `saveDiagnostico`:

```js
saveDiagnostico({
  tipo: req.body.tipo,
  mensagem: req.body.mensagem,
  contexto: req.body.contexto,
  resposta: resultado,
  usuario_id: req.usuario.id,
}).catch(() => {});
```

**Add `GET /historico`** (uses `authJwt`, not `auth`):

```js
router.get("/historico", authJwt, async (req, res) => {
  try {
    const { after } = req.query;
    const items = await getDiagnosticosByUsuario(req.usuario.id, { after });
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ erro: "Erro ao buscar histórico" });
  }
});
```

The `after` parameter is an ISO 8601 timestamp. When provided, only records with `criado_em > after` are returned (used by the polling mechanism).

**Note:** `authJwt` is imported from `../middleware/authJwt`. The existing `auth` import covers `POST /` only.

---

### 4. Frontend — `public/dashboard/historico.html`

New page with:
- Sidebar matching `index.html` (with "Histórico" nav item active)
- Expandable list: each row shows `tipo`, `problema` (from `resposta.problema`), severity badge (`nivel`), and timestamp
- Click row → detail panel slides open with full: `causa`, `sugestoes` (bulleted list), `confianca`, `mensagem`, `contexto` (JSON)
- Polling: on load fetch all 50, then every 5s fetch `?after=<most_recent_criado_em>` — new items prepend to list
- Empty state: "Nenhum diagnóstico ainda. Integre o SDK no seu projeto." with link to docs
- Error state: inline message if fetch fails

**Severity badge colors:**
- `baixo` → green (`#22c55e`)
- `médio` → yellow (`#eab308`)
- `alto` → red (`#ef4444`)

**"Histórico" nav link** added to `index.html` sidebar as well.

---

### 5. npm SDK — `sdk/index.js` + `sdk/package.json`

Package name: `devinsight`
Entry point: `sdk/index.js`

**API:**

```js
const DevInsight = require('devinsight');
DevInsight.init({ apiKey: 'YOUR_KEY', projectName: 'meu-projeto' });
```

**Behavior:**

- Registers `process.on('uncaughtException', handler)` and `process.on('unhandledRejection', handler)`
- On trigger: sends `POST https://devinsight-api.onrender.com/v1/diagnosticos` with:
  ```json
  {
    "tipo": "silent_backend_error",
    "mensagem": "<err.message>",
    "contexto": { "projectName": "...", "stack": "<err.stack>" }
  }
  ```
- Uses `https` built-in (no dependencies) to avoid adding axios/fetch as a peer dependency concern
- Silently ignores send failures (does not throw)
- After sending, re-emits the original exception so the process still crashes as expected (does not swallow)
- Guards: if `init` not called, handlers are not registered (opt-in only)
- `projectName` optional; defaults to `"unknown"`

**`sdk/package.json`:**
```json
{
  "name": "devinsight",
  "version": "1.0.0",
  "description": "Auto-capture runtime errors and send diagnostics to DevInsight API",
  "main": "index.js",
  "engines": { "node": ">=14" },
  "license": "MIT"
}
```

The SDK lives in `sdk/` within the monorepo. Publishing to npm (`npm publish`) is done manually from that directory — it is not part of this implementation (out of scope, done post-implementation).

---

## Data Flow

```
1. Dev calls DevInsight.init({ apiKey }) in their app
2. App throws uncaughtException or unhandledRejection
3. SDK sends POST /v1/diagnosticos with API key
4. auth middleware resolves apiKey → usuario_id
5. saveDiagnostico saves row with usuario_id
6. Dashboard historico.html polls GET /v1/diagnosticos/historico every 5s
7. authJwt resolves JWT → usuario_id
8. getDiagnosticosByUsuario returns matching rows
9. New rows prepend to the list in real time
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `saveDiagnostico` fails | Logged, not thrown — never blocks API response |
| SDK send fails | Silently ignored — never suppresses the original error |
| `getDiagnosticosByUsuario` throws | Returns 500 with `{ erro: "Erro ao buscar histórico" }` |
| Polling fetch fails | Shows inline error, retries on next interval |
| `after` param missing | Returns last 50 records (initial load) |
| `after` param invalid ISO | Supabase returns empty array (safe — `gt` filter on invalid timestamp matches nothing) |

---

## Testing

**`tests/routes/diagnosticos.test.js`** — add:
- `GET /v1/historico` returns 401 without JWT
- `GET /v1/historico` returns 50 items for authenticated user
- `GET /v1/historico?after=<ts>` returns only newer items
- `POST /` calls `saveDiagnostico` with `usuario_id`

**`tests/db/supabase.test.js`** (if exists) or inline mocks — add:
- `getDiagnosticosByUsuario` applies `usuario_id` filter
- `getDiagnosticosByUsuario` applies `after` filter when provided
- `saveDiagnostico` passes `usuario_id` field

**`tests/sdk/index.test.js`** — add:
- `init` registers process listeners
- `uncaughtException` triggers HTTP POST
- `unhandledRejection` triggers HTTP POST
- Send failure does not suppress original error

---

## Files Summary

| Action | File |
|---|---|
| Migration | Supabase migration (applied via MCP) |
| Modify | `src/db/supabase.js` |
| Modify | `src/routes/diagnosticos.js` |
| Create | `public/dashboard/historico.html` |
| Modify | `public/dashboard/index.html` (add "Histórico" nav link) |
| Modify | `public/dashboard/style.css` (history page styles) |
| Create | `sdk/index.js` |
| Create | `sdk/package.json` |
| Create | `tests/routes/diagnosticos.historico.test.js` |
| Create | `tests/sdk/index.test.js` |
