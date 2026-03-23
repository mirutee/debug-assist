# Frontend SDK (devinsight-browser) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a browser-compatible SDK (`devinsight-browser`) that auto-captures unhandled JS errors and sends them to `/v1/diagnosticos`, with framework adapters for React, Vue, and Svelte.

**Architecture:** A single hand-authored UMD file (`devinsight.browser.js`) serves as the CDN bundle and npm CJS entry. A parallel ESM file (`devinsight.browser.esm.js`) has the same logic with ES module syntax for bundlers. Framework adapters (`react.js`, `vue.js`, `svelte.js`) require the core via `./devinsight.browser.js` and add framework-specific hooks. All adapters are tested with Jest + jsdom.

**Tech Stack:** Vanilla JS (no dependencies), Jest + jest-environment-jsdom for tests, React/Vue/Svelte as peer dependencies (not bundled).

---

## Files

| Action | File | Responsibility |
|---|---|---|
| Create | `sdk/browser/devinsight.browser.js` | UMD core — `init()`, `report()`, `_getClient()`, `_reset()`, CDN auto-init |
| Create | `sdk/browser/devinsight.browser.esm.js` | ESM mirror of the core — same logic, `export` syntax |
| Create | `sdk/browser/react.js` | `ErrorBoundary` class component — `getDerivedStateFromError` + `componentDidCatch` |
| Create | `sdk/browser/vue.js` | Vue 3 plugin — `app.config.errorHandler` |
| Create | `sdk/browser/svelte.js` | Thin wrapper calling `DevInsight.init()` |
| Create | `sdk/browser/package.json` | Package descriptor with `main`, `module`, `exports` |
| Create | `tests/sdk/browser.test.js` | Jest + jsdom tests for core SDK |
| Create | `tests/sdk/browser-react.test.js` | Tests for React ErrorBoundary |
| Create | `tests/sdk/browser-vue.test.js` | Tests for Vue plugin |
| Create | `tests/sdk/browser-svelte.test.js` | Tests for Svelte wrapper |
| Create | `public/sdk/browser.js` | Copy of `devinsight.browser.js` served by `express.static` |
| Modify | `public/docs/sdks.html` | Add Browser/Frontend section before Node.js section |

---

### Task 1: Core SDK + tests

**Files:**
- Create: `sdk/browser/devinsight.browser.js`
- Create: `sdk/browser/devinsight.browser.esm.js`
- Create: `sdk/browser/package.json`
- Create: `tests/sdk/browser.test.js`

- [ ] **Step 1: Install test dependency**

```bash
npm install --save-dev jest-environment-jsdom
```

Expected: `jest-environment-jsdom` added to `package.json` devDependencies.

- [ ] **Step 2: Write failing tests**

Create `tests/sdk/browser.test.js`:

```js
/**
 * @jest-environment jsdom
 */
'use strict';

// Reset module between tests so _initialized state is fresh
beforeEach(() => {
  jest.resetModules();
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

afterEach(() => {
  window.onerror = null;
});

function loadSdk() {
  return require('../../sdk/browser/devinsight.browser.js');
}

describe('DevInsight browser SDK — init()', () => {
  it('does nothing when apiKey is absent', () => {
    const DI = loadSdk();
    DI.init({});
    expect(window.onerror).toBeNull();
  });

  it('registers window.onerror when apiKey is provided', () => {
    const DI = loadSdk();
    DI.init({ apiKey: 'test-key' });
    expect(window.onerror).toBeInstanceOf(Function);
  });

  it('does not register hooks when meta devinsight-enabled="0"', () => {
    const meta = document.createElement('meta');
    meta.name = 'devinsight-enabled';
    meta.content = '0';
    document.head.appendChild(meta);
    const DI = loadSdk();
    DI.init({ apiKey: 'test-key' });
    expect(window.onerror).toBeNull();
    document.head.removeChild(meta);
  });

  it('chains a pre-existing window.onerror', () => {
    const prev = jest.fn().mockReturnValue(false);
    window.onerror = prev;
    const DI = loadSdk();
    DI.init({ apiKey: 'test-key' });
    window.onerror('msg', 'file.js', 1, 1, new Error('test'));
    expect(prev).toHaveBeenCalled();
  });

  it('does not register hooks twice on repeated init() calls', () => {
    const DI = loadSdk();
    DI.init({ apiKey: 'test-key' });
    const handler1 = window.onerror;
    DI.init({ apiKey: 'other-key' });
    expect(window.onerror).toBe(handler1);
  });
});

describe('DevInsight browser SDK — payload', () => {
  it('sends correct payload on window.onerror', async () => {
    const DI = loadSdk();
    DI.init({ apiKey: 'my-key', projectName: 'proj' });
    const err = new TypeError('bad value');
    window.onerror('bad value', 'file.js', 1, 1, err);
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledWith(
      'https://devinsight-api.onrender.com/v1/diagnosticos',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer my-key' }),
      })
    );
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.tipo).toBe('silent_frontend_error');
    expect(body.mensagem).toBe('bad value');
    expect(body.contexto.project_name).toBe('proj');
    expect(body.contexto.exception_type).toBe('TypeError');
  });

  it('uses custom baseUrl', async () => {
    const DI = loadSdk();
    DI.init({ apiKey: 'key', baseUrl: 'http://localhost:3000' });
    window.onerror('msg', 'f.js', 1, 1, new Error('e'));
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/diagnosticos',
      expect.anything()
    );
  });

  it('sends on unhandledrejection', async () => {
    const DI = loadSdk();
    DI.init({ apiKey: 'key' });
    const reason = new Error('rejected');
    window.dispatchEvent(
      Object.assign(new Event('unhandledrejection'), { reason, promise: Promise.resolve() })
    );
    await Promise.resolve();
    expect(fetch).toHaveBeenCalled();
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.tipo).toBe('silent_frontend_error');
    expect(body.mensagem).toBe('rejected');
  });

  it('silently ignores fetch failures', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
    const DI = loadSdk();
    DI.init({ apiKey: 'key' });
    expect(() => window.onerror('msg', 'f.js', 1, 1, new Error('e'))).not.toThrow();
    await Promise.resolve();
  });
});

describe('DevInsight browser SDK — report()', () => {
  it('sends diagnostic using stored client', async () => {
    const DI = loadSdk();
    DI.init({ apiKey: 'key', projectName: 'p' });
    DI.report(new TypeError('manual report'));
    await Promise.resolve();
    expect(fetch).toHaveBeenCalled();
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.mensagem).toBe('manual report');
    expect(body.contexto.project_name).toBe('p');
  });

  it('no-ops when init() was not called', async () => {
    const DI = loadSdk();
    DI.report(new Error('nothing'));
    await Promise.resolve();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('accepts explicit config override', async () => {
    const DI = loadSdk();
    DI.report(new Error('override'), {
      apiKey: 'override-key',
      projectName: 'override-proj',
      baseUrl: 'https://devinsight-api.onrender.com',
    });
    await Promise.resolve();
    expect(fetch).toHaveBeenCalled();
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.contexto.project_name).toBe('override-proj');
  });
});
```

- [ ] **Step 3: Run tests — verify they fail**

```bash
npx jest tests/sdk/browser.test.js --no-coverage
```

Expected: FAIL — "Cannot find module '../../sdk/browser/devinsight.browser.js'"

- [ ] **Step 4: Create `sdk/browser/devinsight.browser.js`**

```js
// sdk/browser/devinsight.browser.js
// UMD — works as <script> tag (window.DevInsight) and CommonJS (require)
(function (global, factory) {
  'use strict';
  if (typeof exports !== 'undefined') {
    module.exports = factory();
  } else {
    global.DevInsight = factory();
  }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var DEFAULT_BASE_URL = 'https://devinsight-api.onrender.com';
  var _initialized = false;
  var _client = null;

  function _isDisabled() {
    if (typeof document === 'undefined') return false;
    var meta = document.querySelector('meta[name="devinsight-enabled"]');
    return meta !== null && meta.getAttribute('content') === '0';
  }

  function _exType(err) {
    return (err && err.constructor && err.constructor.name) ? err.constructor.name : 'Error';
  }

  function _send(config, mensagem, exceptionType, stack) {
    try {
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var tid = controller ? setTimeout(function () { controller.abort(); }, 10000) : null;
      var reqOpts = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + config.apiKey,
        },
        body: JSON.stringify({
          tipo: 'silent_frontend_error',
          mensagem: mensagem,
          contexto: {
            project_name: config.projectName,
            exception_type: exceptionType,
            stack: stack || '',
            url: typeof location !== 'undefined' ? location.href : '',
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          },
        }),
      };
      if (controller) reqOpts.signal = controller.signal;
      fetch(config.baseUrl + '/v1/diagnosticos', reqOpts)
        .then(function () { if (tid) clearTimeout(tid); })
        .catch(function () { if (tid) clearTimeout(tid); });
    } catch (_) { /* never cascade */ }
  }

  var DevInsight = {
    init: function (opts) {
      if (_initialized) return;
      if (_isDisabled()) return;
      var apiKey = (opts && opts.apiKey) || '';
      if (!apiKey) return;
      var projectName = (opts && opts.projectName) || 'unknown';
      var baseUrl = ((opts && opts.baseUrl) || DEFAULT_BASE_URL).replace(/\/+$/, '');
      _initialized = true;
      _client = { apiKey: apiKey, projectName: projectName, baseUrl: baseUrl };

      var prev = (typeof window !== 'undefined' && window.onerror) ? window.onerror : null;
      window.onerror = function (msg, _src, _line, _col, err) {
        try {
          _send(_client,
            err ? err.message : String(msg),
            err ? _exType(err) : 'Error',
            err ? (err.stack || '') : ''
          );
        } catch (_) {}
        if (prev) return prev.apply(this, arguments);
        return false;
      };

      window.addEventListener('unhandledrejection', function (ev) {
        try {
          var reason = ev.reason;
          var isErr = reason instanceof Error;
          _send(_client,
            isErr ? reason.message : String(reason),
            isErr ? _exType(reason) : 'UnhandledRejection',
            isErr ? (reason.stack || '') : ''
          );
        } catch (_) {}
      });
    },

    report: function (error, config) {
      var c = config || _client;
      if (!c || !c.apiKey) return;
      var isErr = error instanceof Error;
      _send(c,
        isErr ? error.message : String(error),
        isErr ? _exType(error) : 'Error',
        isErr ? (error.stack || '') : ''
      );
    },

    _getClient: function () { return _client; },
    _reset: function () { _initialized = false; _client = null; },
  };

  // CDN auto-init: read data-api-key from the current <script> tag at load time
  if (typeof document !== 'undefined') {
    var _currentScript = document.currentScript;
    if (_currentScript && _currentScript.getAttribute('data-api-key')) {
      var _autoInit = function () {
        DevInsight.init({
          apiKey: _currentScript.getAttribute('data-api-key'),
          projectName: _currentScript.getAttribute('data-project') || 'unknown',
          baseUrl: _currentScript.getAttribute('data-base-url') || DEFAULT_BASE_URL,
        });
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _autoInit);
      } else {
        _autoInit();
      }
    }
  }

  return DevInsight;
}));
```

- [ ] **Step 5: Create `sdk/browser/devinsight.browser.esm.js`**

```js
// sdk/browser/devinsight.browser.esm.js
// ESM — for bundlers (Vite, Rollup, webpack 5) that respect the "module" field
const DEFAULT_BASE_URL = 'https://devinsight-api.onrender.com';
let _initialized = false;
let _client = null;

function _isDisabled() {
  if (typeof document === 'undefined') return false;
  const meta = document.querySelector('meta[name="devinsight-enabled"]');
  return meta !== null && meta.getAttribute('content') === '0';
}

function _exType(err) {
  return (err && err.constructor && err.constructor.name) ? err.constructor.name : 'Error';
}

function _send(config, mensagem, exceptionType, stack) {
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tid = controller ? setTimeout(() => controller.abort(), 10000) : null;
    const reqOpts = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        tipo: 'silent_frontend_error',
        mensagem,
        contexto: {
          project_name: config.projectName,
          exception_type: exceptionType,
          stack: stack || '',
          url: typeof location !== 'undefined' ? location.href : '',
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        },
      }),
    };
    if (controller) reqOpts.signal = controller.signal;
    fetch(`${config.baseUrl}/v1/diagnosticos`, reqOpts)
      .then(() => { if (tid) clearTimeout(tid); })
      .catch(() => { if (tid) clearTimeout(tid); });
  } catch (_) { /* never cascade */ }
}

export function init(opts = {}) {
  if (_initialized) return;
  if (_isDisabled()) return;
  const apiKey = opts.apiKey || '';
  if (!apiKey) return;
  const projectName = opts.projectName || 'unknown';
  const baseUrl = (opts.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  _initialized = true;
  _client = { apiKey, projectName, baseUrl };

  const prev = (typeof window !== 'undefined' && window.onerror) ? window.onerror : null;
  window.onerror = function (msg, _src, _line, _col, err) {
    try {
      _send(_client, err ? err.message : String(msg), err ? _exType(err) : 'Error', err ? (err.stack || '') : '');
    } catch (_) {}
    if (prev) return prev.apply(this, arguments);
    return false;
  };

  window.addEventListener('unhandledrejection', (ev) => {
    try {
      const reason = ev.reason;
      const isErr = reason instanceof Error;
      _send(_client, isErr ? reason.message : String(reason), isErr ? _exType(reason) : 'UnhandledRejection', isErr ? (reason.stack || '') : '');
    } catch (_) {}
  });
}

export function report(error, config) {
  const c = config || _client;
  if (!c || !c.apiKey) return;
  const isErr = error instanceof Error;
  _send(c, isErr ? error.message : String(error), isErr ? _exType(error) : 'Error', isErr ? (error.stack || '') : '');
}

export function _getClient() { return _client; }
export function _reset() { _initialized = false; _client = null; }

export default { init, report, _getClient, _reset };
```

- [ ] **Step 6: Create `sdk/browser/package.json`**

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
  "files": [
    "devinsight.browser.js",
    "devinsight.browser.esm.js",
    "react.js",
    "vue.js",
    "svelte.js"
  ],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/mirutee/devinsight-api.git"
  }
}
```

- [ ] **Step 7: Run tests — verify they pass**

```bash
npx jest tests/sdk/browser.test.js --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json sdk/browser/devinsight.browser.js sdk/browser/devinsight.browser.esm.js sdk/browser/package.json tests/sdk/browser.test.js
git commit -m "feat: add devinsight-browser core SDK (UMD + ESM)"
```

---

### Task 2: React adapter + tests

**Files:**
- Create: `sdk/browser/react.js`
- Create: `tests/sdk/browser-react.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/sdk/browser-react.test.js`:

```js
/**
 * @jest-environment jsdom
 */
'use strict';

// Mock React minimally — we test the class logic, not DOM rendering
const React = {
  Component: class Component {
    constructor(props) { this.props = props; this.state = {}; }
    setState(s) { Object.assign(this.state, s); }
  },
};
jest.mock('react', () => React);

beforeEach(() => {
  jest.resetModules();
  jest.mock('react', () => React);
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

afterEach(() => {
  window.onerror = null;
});

function loadBoundary() {
  const { ErrorBoundary } = require('../../sdk/browser/react.js');
  return ErrorBoundary;
}

describe('ErrorBoundary', () => {
  it('getDerivedStateFromError returns { hasError: true }', () => {
    const ErrorBoundary = loadBoundary();
    const state = ErrorBoundary.getDerivedStateFromError(new Error('test'));
    expect(state).toEqual({ hasError: true });
  });

  it('componentDidCatch sends diagnostic using global client', async () => {
    // Init the core SDK first to set the global client
    const DI = require('../../sdk/browser/devinsight.browser.js');
    DI.init({ apiKey: 'global-key', projectName: 'global-proj' });

    const ErrorBoundary = loadBoundary();
    const boundary = new ErrorBoundary({});
    boundary.componentDidCatch(new TypeError('render error'), {});
    await Promise.resolve();
    expect(fetch).toHaveBeenCalled();
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.tipo).toBe('silent_frontend_error');
    expect(body.mensagem).toBe('render error');
    expect(body.contexto.exception_type).toBe('TypeError');
  });

  it('componentDidCatch uses prop apiKey when provided', async () => {
    const ErrorBoundary = loadBoundary();
    const boundary = new ErrorBoundary({ apiKey: 'prop-key', projectName: 'prop-proj' });
    boundary.componentDidCatch(new Error('prop error'), {});
    await Promise.resolve();
    expect(fetch).toHaveBeenCalled();
    const authHeader = fetch.mock.calls[0][1].headers['Authorization'];
    expect(authHeader).toBe('Bearer prop-key');
  });

  it('silently drops diagnostic when no apiKey and no global init', async () => {
    // Do NOT call DI.init() — no global client
    const ErrorBoundary = loadBoundary();
    const boundary = new ErrorBoundary({});
    boundary.componentDidCatch(new Error('no key'), {});
    await Promise.resolve();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('prop apiKey takes precedence over global client', async () => {
    const DI = require('../../sdk/browser/devinsight.browser.js');
    DI.init({ apiKey: 'global-key', projectName: 'global' });

    const ErrorBoundary = loadBoundary();
    const boundary = new ErrorBoundary({ apiKey: 'prop-key', projectName: 'prop' });
    boundary.componentDidCatch(new Error('e'), {});
    await Promise.resolve();
    expect(fetch).toHaveBeenCalled();
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.contexto.project_name).toBe('prop');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest tests/sdk/browser-react.test.js --no-coverage
```

Expected: FAIL — "Cannot find module '../../sdk/browser/react.js'"

- [ ] **Step 3: Create `sdk/browser/react.js`**

```js
// sdk/browser/react.js
// React ErrorBoundary component for DevInsight
'use strict';

var React = require('react');
var core = require('./devinsight.browser.js');

var DEFAULT_BASE_URL = 'https://devinsight-api.onrender.com';

var ErrorBoundary = (function (_React$Component) {
  function ErrorBoundary(props) {
    _React$Component.call(this, props);
    this.state = { hasError: false };
  }

  ErrorBoundary.prototype = Object.create(_React$Component.prototype);
  ErrorBoundary.prototype.constructor = ErrorBoundary;

  ErrorBoundary.getDerivedStateFromError = function (_error) {
    return { hasError: true };
  };

  ErrorBoundary.prototype.componentDidCatch = function (error, _info) {
    try {
      var apiKey = this.props.apiKey;
      var config;
      if (apiKey) {
        config = {
          apiKey: apiKey,
          projectName: this.props.projectName || 'unknown',
          baseUrl: (this.props.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ''),
        };
      } else {
        config = core._getClient(); // may be null if init() was not called
      }
      if (config) {
        core.report(error, config);
      }
    } catch (_) { /* never cascade */ }
  };

  ErrorBoundary.prototype.render = function () {
    if (this.state.hasError) {
      return this.props.fallback !== undefined ? this.props.fallback : null;
    }
    return this.props.children;
  };

  return ErrorBoundary;
}(React.Component));

module.exports = { ErrorBoundary: ErrorBoundary };
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest tests/sdk/browser-react.test.js --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add sdk/browser/react.js tests/sdk/browser-react.test.js
git commit -m "feat: add devinsight-browser React ErrorBoundary"
```

---

### Task 3: Vue adapter + tests

**Files:**
- Create: `sdk/browser/vue.js`
- Create: `tests/sdk/browser-vue.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/sdk/browser-vue.test.js`:

```js
/**
 * @jest-environment jsdom
 */
'use strict';

beforeEach(() => {
  jest.resetModules();
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

afterEach(() => {
  window.onerror = null;
});

function loadPlugin() {
  return require('../../sdk/browser/vue.js');
}

describe('Vue DevInsight plugin', () => {
  it('registers app.config.errorHandler', () => {
    const plugin = loadPlugin();
    const app = { config: {}, use: function(p, opts) { p.install(this, opts); } };
    app.use(plugin, { apiKey: 'vue-key' });
    expect(typeof app.config.errorHandler).toBe('function');
  });

  it('calls init() so window.onerror is registered', () => {
    const plugin = loadPlugin();
    const app = { config: {}, use: function(p, opts) { p.install(this, opts); } };
    app.use(plugin, { apiKey: 'vue-key', projectName: 'vue-proj' });
    expect(window.onerror).toBeInstanceOf(Function);
  });

  it('sends diagnostic when app.config.errorHandler fires', async () => {
    const plugin = loadPlugin();
    const app = { config: {}, use: function(p, opts) { p.install(this, opts); } };
    app.use(plugin, { apiKey: 'vue-key', projectName: 'vue-proj' });
    app.config.errorHandler(new TypeError('vue error'), null, 'render');
    await Promise.resolve();
    expect(fetch).toHaveBeenCalled();
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.tipo).toBe('silent_frontend_error');
    expect(body.mensagem).toBe('vue error');
  });

  it('chains a pre-existing app.config.errorHandler', async () => {
    const prev = jest.fn();
    const plugin = loadPlugin();
    const app = { config: { errorHandler: prev }, use: function(p, opts) { p.install(this, opts); } };
    app.use(plugin, { apiKey: 'vue-key' });
    app.config.errorHandler(new Error('e'), null, 'x');
    await Promise.resolve();
    expect(prev).toHaveBeenCalledWith(expect.any(Error), null, 'x');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest tests/sdk/browser-vue.test.js --no-coverage
```

Expected: FAIL — "Cannot find module '../../sdk/browser/vue.js'"

- [ ] **Step 3: Create `sdk/browser/vue.js`**

```js
// sdk/browser/vue.js
// Vue 3 plugin for DevInsight
'use strict';

var core = require('./devinsight.browser.js');

var DevInsightPlugin = {
  install: function (app, opts) {
    var apiKey = (opts && opts.apiKey) || '';
    var projectName = (opts && opts.projectName) || 'unknown';
    var baseUrl = (opts && opts.baseUrl);

    if (apiKey) {
      core.init({ apiKey: apiKey, projectName: projectName, baseUrl: baseUrl });
    }

    var prev = app.config.errorHandler || null;
    app.config.errorHandler = function (err, vm, info) {
      try {
        core.report(err);
      } catch (_) {}
      if (prev) prev(err, vm, info);
    };
  },
};

module.exports = DevInsightPlugin;
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest tests/sdk/browser-vue.test.js --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add sdk/browser/vue.js tests/sdk/browser-vue.test.js
git commit -m "feat: add devinsight-browser Vue plugin"
```

---

### Task 4: Svelte adapter + tests

**Files:**
- Create: `sdk/browser/svelte.js`
- Create: `tests/sdk/browser-svelte.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/sdk/browser-svelte.test.js`:

```js
/**
 * @jest-environment jsdom
 */
'use strict';

beforeEach(() => {
  jest.resetModules();
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

afterEach(() => {
  window.onerror = null;
});

function loadSvelte() {
  return require('../../sdk/browser/svelte.js');
}

describe('Svelte DevInsight wrapper', () => {
  it('exports initDevInsight function', () => {
    const { initDevInsight } = loadSvelte();
    expect(typeof initDevInsight).toBe('function');
  });

  it('registers window.onerror when called with apiKey', () => {
    const { initDevInsight } = loadSvelte();
    initDevInsight({ apiKey: 'svelte-key', projectName: 'svelte-proj' });
    expect(window.onerror).toBeInstanceOf(Function);
  });

  it('captures errors via window.onerror after initDevInsight()', async () => {
    const { initDevInsight } = loadSvelte();
    initDevInsight({ apiKey: 'svelte-key', projectName: 'svelte-proj' });
    window.onerror('crash', 'file.js', 1, 1, new Error('svelte crash'));
    await Promise.resolve();
    expect(fetch).toHaveBeenCalled();
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.contexto.project_name).toBe('svelte-proj');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest tests/sdk/browser-svelte.test.js --no-coverage
```

Expected: FAIL — "Cannot find module '../../sdk/browser/svelte.js'"

- [ ] **Step 3: Create `sdk/browser/svelte.js`**

```js
// sdk/browser/svelte.js
// Svelte wrapper for DevInsight — delegates to core window.onerror hook
// Svelte does not expose a global component error hook; window.onerror covers all crashes
'use strict';

var core = require('./devinsight.browser.js');

function initDevInsight(opts) {
  core.init(opts);
}

module.exports = { initDevInsight: initDevInsight };
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest tests/sdk/browser-svelte.test.js --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add sdk/browser/svelte.js tests/sdk/browser-svelte.test.js
git commit -m "feat: add devinsight-browser Svelte wrapper"
```

---

### Task 5: CDN copy + documentation

**Files:**
- Create: `public/sdk/browser.js`
- Modify: `public/docs/sdks.html`

- [ ] **Step 1: Copy core file to public/sdk/**

```bash
mkdir -p public/sdk
cp sdk/browser/devinsight.browser.js public/sdk/browser.js
```

Verify: `public/sdk/browser.js` exists and content matches `sdk/browser/devinsight.browser.js`.

- [ ] **Step 2: Run all browser SDK tests to confirm everything still passes**

```bash
npx jest tests/sdk/browser.test.js tests/sdk/browser-react.test.js tests/sdk/browser-vue.test.js tests/sdk/browser-svelte.test.js --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 3: Add Browser/Frontend section to `public/docs/sdks.html`**

Open `public/docs/sdks.html`. Find the comment `<!-- Node.js -->` (around line 81). Insert the following block **before** it (after the opening `<div class="content">` tag):

```html
    <!-- Browser / Frontend -->
    <div class="sdk-card">
      <div class="sdk-header">
        <div class="sdk-icon">🌐</div>
        <div class="sdk-name">Browser / Frontend</div>
        <div class="sdk-tag">CDN · npm</div>
      </div>
      <p class="sdk-desc">Captura <code>window.onerror</code> e <code>unhandledrejection</code> automaticamente. Funciona em qualquer projeto JS, React, Vue ou Svelte.</p>

      <div class="install-label">Vanilla JS — via CDN (sem build)</div>
      <pre><code><span class="comment">&lt;!-- Adicione no &lt;head&gt; do seu HTML --&gt;</span>
&lt;script src=<span class="string">"https://devinsight-api.onrender.com/sdk/browser.js"</span>
        data-api-key=<span class="string">"SUA_API_KEY"</span>
        data-project=<span class="string">"meu-app"</span>&gt;&lt;/script&gt;</code></pre>

      <div class="install-label">npm (React, Vue, Svelte, etc.)</div>
      <pre><code>npm install devinsight-browser</code></pre>
      <pre><code><span class="comment">// Inicialização manual (ES module)</span>
<span class="keyword">import</span> DevInsight <span class="keyword">from</span> <span class="string">'devinsight-browser'</span>;
DevInsight.init({ apiKey: <span class="string">'SUA_API_KEY'</span>, projectName: <span class="string">'meu-app'</span> });</code></pre>

      <div class="install-label">React — ErrorBoundary</div>
      <pre><code><span class="keyword">import</span> { ErrorBoundary } <span class="keyword">from</span> <span class="string">'devinsight-browser/react'</span>;

<span class="comment">// Envolva seu componente raiz:</span>
&lt;ErrorBoundary apiKey=<span class="string">"SUA_API_KEY"</span> projectName=<span class="string">"meu-app"</span>
               fallback={&lt;p&gt;Algo deu errado.&lt;/p&gt;}&gt;
  &lt;App /&gt;
&lt;/ErrorBoundary&gt;</code></pre>

      <div class="install-label">Vue 3 — plugin</div>
      <pre><code><span class="keyword">import</span> DevInsightPlugin <span class="keyword">from</span> <span class="string">'devinsight-browser/vue'</span>;

app.use(DevInsightPlugin, { apiKey: <span class="string">'SUA_API_KEY'</span>, projectName: <span class="string">'meu-app'</span> });</code></pre>

      <div class="install-label">Svelte</div>
      <pre><code><span class="keyword">import</span> { initDevInsight } <span class="keyword">from</span> <span class="string">'devinsight-browser/svelte'</span>;

<span class="comment">// Em main.js ou componente raiz:</span>
initDevInsight({ apiKey: <span class="string">'SUA_API_KEY'</span>, projectName: <span class="string">'meu-app'</span> });</code></pre>

      <div class="env-box">
        <h4>Configuração</h4>
        <div class="env-row"><span class="env-key">data-api-key / apiKey</span><span class="env-val">Sua API Key (obrigatória)</span></div>
        <div class="env-row"><span class="env-key">data-project / projectName</span><span class="env-val">Nome do projeto (default: unknown)</span></div>
        <div class="env-row"><span class="env-key">data-base-url / baseUrl</span><span class="env-val">URL base da API (default: https://devinsight-api.onrender.com)</span></div>
        <div class="env-row"><span class="env-key">&lt;meta name="devinsight-enabled" content="0"&gt;</span><span class="env-val">Desliga o SDK em qualquer ambiente</span></div>
      </div>
    </div>

    <hr class="divider">
```

- [ ] **Step 4: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: All tests PASS (no regressions).

- [ ] **Step 5: Commit**

```bash
git add public/sdk/browser.js public/docs/sdks.html
git commit -m "feat: adicionar SDK browser na CDN e na documentação"
```
