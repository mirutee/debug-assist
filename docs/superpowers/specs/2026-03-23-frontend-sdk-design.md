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
- Chain any pre-existing `window.onerror` handler: store the previous value before replacing it and call it after DevInsight sends the diagnostic. For `unhandledrejection`, use `addEventListener` — listeners stack naturally, so no chaining logic is needed
- `contexto` field keys use `snake_case` (`project_name`, `exception_type`, `user_agent`) — consistent with the Go, PHP, Ruby, C#, and Python SDKs. The Node.js SDK's `projectName` camelCase is a known inconsistency in that SDK and is not replicated here
- Silently ignore send failures (network errors must not cascade)
- No external dependencies — native `fetch` only
- Disabled check (meta tag `<meta name="devinsight-enabled" content="0">`) applies to ALL init paths — both CDN auto-init and explicit `DevInsight.init()` calls. If present with value `"0"`, no hooks are registered regardless of how init was triggered
- HTTP timeout: 10 seconds
- The `dados` field used by the Node.js SDK is intentionally omitted from the browser SDK payload — browser errors have no SQL/query context

---

## Repository Structure

```
sdk/browser/
  devinsight.browser.js   ← source file; distributed as both CDN bundle and npm entry
  react.js                ← React ErrorBoundary component
  vue.js                  ← Vue 3 plugin (app.use)
  svelte.js               ← Svelte init wrapper (delegates to core window.onerror)
  package.json            ← defines main, module, and exports fields
public/sdk/
  browser.js              ← copy of devinsight.browser.js (served statically; public/ is already under express.static so no app.js change needed)
```

---

## SDK Specs

### Core (`sdk/browser/devinsight.browser.js`)

**Hooks registered by `init()`:**
- `window.onerror` — synchronous errors and script load errors. Stores any previous `window.onerror` and calls it after DevInsight sends the diagnostic
- `window.addEventListener('unhandledrejection', ...)` — unhandled Promise rejections

**CDN auto-init:** When the script tag includes `data-api-key`, init fires automatically on `DOMContentLoaded`:
```html
<script src="https://devinsight-api.onrender.com/sdk/browser.js"
        data-api-key="SUA_API_KEY"
        data-project="meu-app"></script>
```

**Explicit init:**
```js
DevInsight.init({ apiKey: 'SUA_API_KEY', projectName: 'meu-app', baseUrl: 'https://...' })
```

**Disabled check:** On every init path (CDN and explicit), read `<meta name="devinsight-enabled" content="0">`. If the meta tag is present with value `"0"`, skip all hook registration silently.

**Module format:**
- `devinsight.browser.js` — UMD file (hand-authored). Works as `<script>` tag (exposes `window.DevInsight`) and as CommonJS (`require`)
- `devinsight.browser.esm.js` — ESM file (hand-authored as a separate source file, shares the same logic). Used by bundlers (Vite, Rollup, webpack 5) that respect the `module` field. No build step is required — both files are maintained manually as they are small and have no external dependencies

**Config supported:**
- `data-api-key` / `apiKey` — API key (required; no hooks registered if absent)
- `data-project` / `projectName` — project name (default: `"unknown"`)
- `data-base-url` / `baseUrl` — API base URL (default: `"https://devinsight-api.onrender.com"`). The CDN auto-init reads this via `script.getAttribute('data-base-url')` (kebab-case)
- `<meta name="devinsight-enabled" content="0">` — disables SDK on all init paths

---

### React (`sdk/browser/react.js`)

**Hooks:** `static getDerivedStateFromError(error)` + `componentDidCatch(error, info)`

**Usage:**
```jsx
import { ErrorBoundary } from 'devinsight-browser/react'

<ErrorBoundary apiKey="SUA_API_KEY" projectName="meu-app" fallback={<p>Algo deu errado.</p>}>
  <App />
</ErrorBoundary>
```

**Behavior:**
- `getDerivedStateFromError`: sets `{ hasError: true }` state so the boundary renders the `fallback` prop
- `componentDidCatch`: sends the diagnostic to DevInsight. Does NOT re-throw (throwing inside `componentDidCatch` causes undefined behavior in React). The fallback UI is shown via state, not via re-throwing

**Props:**
- `apiKey` (optional if `DevInsight.init()` was already called globally; required otherwise). If both `apiKey` prop and a prior global init exist, the prop takes precedence and a new client is created for this boundary. If `apiKey` is absent, the boundary reuses the global client set by `DevInsight.init()`
- `projectName` (default: `"unknown"`)
- `fallback` (optional ReactNode shown after error; default: `null`)

---

### Vue (`sdk/browser/vue.js`)

**Hook:** `app.config.errorHandler`

**Usage:**
```js
import DevInsightPlugin from 'devinsight-browser/vue'
app.use(DevInsightPlugin, { apiKey: 'SUA_API_KEY', projectName: 'meu-app' })
```

**Behavior:** Registers `app.config.errorHandler`. If a previous handler existed, chains it — DevInsight sends the diagnostic first, then the previous handler is called. Error propagates normally.

---

### Svelte (`sdk/browser/svelte.js`)

**Hook:** Delegates to core `window.onerror` — Svelte does not expose a global component error lifecycle hook equivalent to React's `componentDidCatch`. The `svelte.js` module is a thin convenience wrapper that calls `DevInsight.init()`.

**Usage:**
```js
// In main.js or root component
import { initDevInsight } from 'devinsight-browser/svelte'
initDevInsight({ apiKey: 'SUA_API_KEY', projectName: 'meu-app' })
```

**Behavior:** Calls `DevInsight.init()` with the provided config. Errors captured via `window.onerror` and `unhandledrejection`. No Svelte-version-specific APIs are used, so this works with Svelte 3, 4, and 5.

---

## Payload (all patterns)

The `dados` field is intentionally absent — browser errors have no SQL/query context. All other fields match the existing SDK contract.

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

## `package.json` (`sdk/browser/package.json`)

```json
{
  "name": "devinsight-browser",
  "version": "1.0.0",
  "description": "DevInsight browser SDK — auto-captures frontend errors",
  "main": "devinsight.browser.js",
  "module": "devinsight.browser.esm.js",
  "exports": {
    ".": {
      "import": "./devinsight.browser.esm.js",
      "require": "./devinsight.browser.js"
    },
    "./react": "./react.js",
    "./vue": "./vue.js",
    "./svelte": "./svelte.js"
  },
  "files": ["devinsight.browser.js", "devinsight.browser.esm.js", "react.js", "vue.js", "svelte.js"],
  "license": "MIT"
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
| `devinsight-enabled` meta = `"0"` | No hooks registered on any init path; SDK is silent |
| API key not set | No hooks registered |
| Network timeout (10s) | Silently ignored — original error propagates normally |
| API returns error | Silently ignored — original error propagates normally |
| Handler throws internally | Wrapped in try/catch — original error propagates normally |
| Previous `window.onerror` existed | Both called — DevInsight first, then previous handler |
| React: error boundary catches error | `fallback` prop shown; diagnostic sent via `componentDidCatch` |
| React: `apiKey` absent and `DevInsight.init()` not called | Diagnostic silently dropped; `fallback` still shown; no exception thrown |
| Vue: previous errorHandler existed | Both called — DevInsight first, then previous handler |
| Promise rejection already handled | Nothing sent — only `unhandledrejection` events fire |

---

## Files Summary

| Action | File |
|---|---|
| Create | `sdk/browser/devinsight.browser.js` |
| Create | `sdk/browser/devinsight.browser.esm.js` |
| Create | `sdk/browser/react.js` |
| Create | `sdk/browser/vue.js` |
| Create | `sdk/browser/svelte.js` |
| Create | `sdk/browser/package.json` |
| Create | `public/sdk/browser.js` (manual copy of `sdk/browser/devinsight.browser.js`; served automatically by existing `express.static('public')`; kept in sync by running `cp sdk/browser/devinsight.browser.js public/sdk/browser.js` after any change to the source) |
| Modify | `public/docs/sdks.html` (add Browser/Frontend section) |
