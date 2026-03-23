# Frontend SDK — Design Spec

**Date:** 2026-03-23
**Status:** Approved

---

## Goal

Provide a browser-compatible SDK (`devinsight-browser`) that auto-captures unhandled JS errors and Promise rejections and sends them to the DevInsight API — with no build step required for vanilla HTML projects, and framework adapters for React, Vue, and Svelte.

---

## Principle

> Configured API key + one line = browser errors appear on the dashboard.

All patterns share the same contract:
- Register hooks on `init()` (or automatically via `data-api-key` attribute on the script tag)
- On error: POST to `/v1/diagnosticos` with `tipo: "silent_frontend_error"`, error message, stack trace, exception type, URL, user agent, project name
- Never suppress or alter the original error — only observe it
- Silently ignore send failures (network errors must not cascade)
- No external dependencies — native `fetch` only
- Respects `DEVINSIGHT_ENABLED=0` via `<meta name="devinsight-enabled" content="0">` or env var
- HTTP timeout: 10 seconds

---

## Repository Structure

```
sdk/browser/
  devinsight.browser.js   ← UMD bundle — CDN file AND npm main entry
  react.js                ← React ErrorBoundary component
  vue.js                  ← Vue 3 plugin (app.use)
  svelte.js               ← Svelte onError wrapper
  package.json
public/sdk/
  browser.js              ← symlink or copy of devinsight.browser.js (served by Express)
```

---

## SDK Specs

### Core (`sdk/browser/devinsight.browser.js`)

**Hooks registered by `init()`:**
- `window.onerror` — synchronous errors and script load errors
- `window.addEventListener('unhandledrejection', ...)` — unhandled Promise rejections

**CDN auto-init:** When the script tag includes `data-api-key`, init fires automatically on `DOMContentLoaded`:
```html
<script src="https://devinsight-api.onrender.com/sdk/browser.js"
        data-api-key="SUA_API_KEY"
        data-project="meu-app"></script>
```

**Explicit init:**
```js
DevInsight.init({ apiKey: 'SUA_API_KEY', projectName: 'meu-app' })
```

**Disabled check:** Before registering hooks, read `<meta name="devinsight-enabled" content="0">`. If present with value `"0"`, skip all registration silently.

**Module format:** UMD — works as `<script>` (exposes `window.DevInsight`), CommonJS (`require`), and ES module (`import`).

**Env vars / config supported:**
- `data-api-key` / `apiKey` — API key
- `data-project` / `projectName` — project name (default: `"unknown"`)
- `<meta name="devinsight-enabled" content="0">` — disables SDK

---

### React (`sdk/browser/react.js`)

**Hook:** `React.Component.componentDidCatch(error, info)` via an `<ErrorBoundary>` class component.

**Usage:**
```jsx
import { ErrorBoundary } from 'devinsight-browser/react'

<ErrorBoundary apiKey="SUA_API_KEY" projectName="meu-app">
  <App />
</ErrorBoundary>
```

**Behavior:** On `componentDidCatch`, sends the diagnostic then re-throws so the default React error UI (or a custom `fallback` prop) is shown. Never swallows the error.

**Props:**
- `apiKey` (required if not already inited globally)
- `projectName` (default: `"unknown"`)
- `fallback` (optional ReactNode shown after error)

---

### Vue (`sdk/browser/vue.js`)

**Hook:** `app.config.errorHandler`

**Usage:**
```js
import DevInsightPlugin from 'devinsight-browser/vue'
app.use(DevInsightPlugin, { apiKey: 'SUA_API_KEY', projectName: 'meu-app' })
```

**Behavior:** Registers `app.config.errorHandler`. If a previous handler existed, chains it (calls previous handler after sending). Error propagates normally.

---

### Svelte (`sdk/browser/svelte.js`)

**Hook:** Wraps Svelte's `handleError` lifecycle.

**Usage:**
```js
// In your root component or main.js
import { initDevInsight } from 'devinsight-browser/svelte'
initDevInsight({ apiKey: 'SUA_API_KEY', projectName: 'meu-app' })
```

**Behavior:** Calls `DevInsight.init()` with the provided config. Relies on the core `window.onerror` hook since Svelte does not expose a global component error hook equivalent to React's `componentDidCatch`. For Svelte 5+, also chains into `onError` if available.

---

## Payload (all patterns)

```json
POST /v1/diagnosticos
Authorization: Bearer SUA_API_KEY
Content-Type: application/json

{
  "tipo": "silent_frontend_error",
  "mensagem": "<error message>",
  "contexto": {
    "project_name": "meu-app",
    "exception_type": "TypeError",
    "stack": "<stack trace string>",
    "url": "https://app.com/dashboard",
    "user_agent": "Mozilla/5.0 ..."
  }
}
```

---

## Documentation Page (`public/docs/sdks.html`)

Add a **Browser / Frontend** section to the existing `/docs/sdks.html` page (between the intro and Node.js section). Sections:

1. **Vanilla JS / CDN** — `<script>` tag with `data-api-key`
2. **npm (ES module)** — `npm install devinsight-browser` + `DevInsight.init()`
3. **React** — `<ErrorBoundary>` usage
4. **Vue** — `app.use(DevInsightPlugin, ...)`
5. **Svelte** — `initDevInsight(...)` usage

Style: matches existing dark theme. Code blocks use `<pre><code>` format.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `devinsight-enabled` meta = `"0"` | No hooks registered, SDK is silent |
| API key not set | No hooks registered |
| Network timeout (10s) | Silently ignored — original error propagates normally |
| API returns error | Silently ignored — original error propagates normally |
| Handler throws | Wrapped in try/catch — original error propagates normally |
| React: error boundary renders fallback | `fallback` prop shown; error still sent |
| Vue: previous errorHandler existed | Both called — DevInsight first, then previous handler |
| Promise rejection already handled | Nothing sent — only `unhandledrejection` events |

---

## Files Summary

| Action | File |
|---|---|
| Create | `sdk/browser/devinsight.browser.js` |
| Create | `sdk/browser/react.js` |
| Create | `sdk/browser/vue.js` |
| Create | `sdk/browser/svelte.js` |
| Create | `sdk/browser/package.json` |
| Create | `public/sdk/browser.js` (copy served statically) |
| Modify | `public/docs/sdks.html` (add Browser/Frontend section) |
| Modify | `src/app.js` or main Express file (serve `public/sdk/browser.js`) |
