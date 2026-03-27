# Dark/Light Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dark/light theme toggle to all pages of the site — landing, login, signup, and all dashboard pages — using CSS custom properties and `data-theme` attribute without touching page structure.

**Architecture:** A single IIFE script in each page's `<head>` reads `localStorage` and `prefers-color-scheme` and sets `data-theme` on `<html>` before the first paint, preventing FOUC. A `toggleTheme()` / `updateThemeIcon()` pair (inline JS) handles user interaction. Light tokens override `:root` via `[data-theme="light"]` in both CSS files.

**Tech Stack:** Vanilla CSS custom properties, vanilla JS, localStorage, `matchMedia`

---

## File Map

| File | Change |
|---|---|
| `public/style.css` | Add `[data-theme="light"]` token block + navbar light override + `.theme-toggle-float` styles |
| `public/dashboard/style.css` | Add `[data-theme="light"]` token block + `.theme-toggle-sidebar` styles |
| `public/index.html` | Init script in `<head>` + floating button + toggle JS before `</body>` |
| `public/dashboard/index.html` | Init script in `<head>` + sidebar button + `toggleTheme` / `updateThemeIcon` in existing `<script>` |
| `public/dashboard/historico.html` | Same as dashboard/index.html |
| `public/dashboard/alertas.html` | Same as dashboard/index.html |
| `public/dashboard/configuracoes.html` | Same as dashboard/index.html |
| `public/dashboard/login.html` | Init script in `<head>` + floating button + toggle JS before `</body>` |
| `public/dashboard/signup.html` | Init script in `<head>` + floating button + toggle JS before `</body>` |
| `tests/routes/landing.test.js` | Add assertions: page contains `theme-toggle` button and `da_theme` |
| `tests/routes/dashboard.test.js` | Add assertion: dashboard index contains `theme-toggle` |
| `tests/routes/signup.test.js` | Add assertion: signup page contains `theme-toggle` |

---

## Shared Code Blocks (referenced in tasks below)

**Init script** — goes after `<link rel="stylesheet">`, before `</head>`:
```html
<script>
  (function() {
    try {
      var saved = localStorage.getItem('da_theme');
      var sys = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', saved || sys);
    } catch(e) {}
  })();
</script>
```

**Toggle functions** — for pages with floating button (landing, login, signup):
```html
<script>
  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('da_theme', next); } catch(e) {}
    updateThemeIcon();
  }
  function updateThemeIcon() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.title = isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro';
  }
  document.addEventListener('DOMContentLoaded', updateThemeIcon);
</script>
```

**Floating button** — goes before `</body>` (after the toggle script):
```html
<button id="theme-toggle" class="theme-toggle-float" onclick="toggleTheme()" title="Mudar tema"></button>
```

**Dashboard toggle functions** — for sidebar pages, add these two functions inside the existing `<script>` block:
```js
function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme') || 'dark';
  var next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('da_theme', next); } catch(e) {}
  updateThemeIcon();
}
function updateThemeIcon() {
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.textContent = isDark ? '☀️' : '🌙';
  btn.title = isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro';
}
document.addEventListener('DOMContentLoaded', updateThemeIcon);
```

**Sidebar toggle button** — goes immediately after `<div class="sidebar-footer" id="user-email">`:
```html
<button id="theme-toggle" class="theme-toggle-sidebar" onclick="toggleTheme()" title="Mudar tema"></button>
```

---

## Task 1: CSS — Light theme tokens and toggle button styles

**Files:**
- Modify: `public/style.css`
- Modify: `public/dashboard/style.css`

- [ ] **Step 1: Add light theme tokens and float button CSS to `public/style.css`**

  After the `:root { ... }` block (after line 15), insert:

  ```css
  [data-theme="light"] {
    --bg:      #F8FAFC;
    --surface: #FFFFFF;
    --border:  #CBD5E1;
    --text:    #0F172A;
    --muted:   #64748B;
    --code-bg: #F1F5F9;
  }
  [data-theme="light"] .navbar {
    background: rgba(248,250,252,0.92);
  }
  ```

  At the very end of `public/style.css` (after the `@media` block), append:

  ```css
  /* ── Theme toggle (floating) ────────────────── */
  .theme-toggle-float {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--surface);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    transition: background 0.2s, border-color 0.2s;
  }
  .theme-toggle-float:hover { background: var(--border); }
  ```

- [ ] **Step 2: Add light theme tokens and sidebar button CSS to `public/dashboard/style.css`**

  After the `:root { ... }` block in `public/dashboard/style.css`, insert:

  ```css
  [data-theme="light"] {
    --bg:      #F8FAFC;
    --surface: #FFFFFF;
    --border:  #CBD5E1;
    --text:    #0F172A;
    --muted:   #64748B;
    --code-bg: #F1F5F9;
  }
  ```

  At the very end of `public/dashboard/style.css`, append:

  ```css
  /* ── Theme toggle (sidebar) ─────────────────── */
  .theme-toggle-sidebar {
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--muted);
    font-size: 14px;
    padding: 4px 8px;
    cursor: pointer;
    margin-top: 8px;
    width: 100%;
    text-align: left;
    transition: background 0.2s;
  }
  .theme-toggle-sidebar:hover { background: var(--surface); }
  ```

- [ ] **Step 3: Run all tests to confirm no breakage**

  ```bash
  npm test
  ```

  Expected: all tests pass (CSS changes don't affect JS tests).

- [ ] **Step 4: Commit**

  ```bash
  git add public/style.css public/dashboard/style.css
  git commit -m "feat(theme): add light mode CSS tokens and toggle button styles"
  ```

---

## Task 2: Landing page dark/light toggle

**Files:**
- Test: `tests/routes/landing.test.js`
- Modify: `public/index.html`

- [ ] **Step 1: Write failing tests in `tests/routes/landing.test.js`**

  Add these two `it` blocks inside the existing `describe('Landing page', ...)` block:

  ```js
  it('GET / contém botão theme-toggle', async () => {
    const res = await request(app).get('/');
    expect(res.text).toContain('id="theme-toggle"');
  });

  it('GET / contém script de inicialização de tema', async () => {
    const res = await request(app).get('/');
    expect(res.text).toContain('da_theme');
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  npx jest tests/routes/landing.test.js --no-coverage
  ```

  Expected: the 2 new tests FAIL (`expect(received).toContain(expected)` errors).

- [ ] **Step 3: Add init script to `public/index.html`**

  In `public/index.html`, after line 9 (`<link rel="stylesheet" href="/style.css">`), insert:

  ```html
  <script>
    (function() {
      try {
        var saved = localStorage.getItem('da_theme');
        var sys = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', saved || sys);
      } catch(e) {}
    })();
  </script>
  ```

- [ ] **Step 4: Add toggle button and JS to `public/index.html`**

  In `public/index.html`, before `</body>` (currently at line 180), insert:

  ```html
  <script>
    function toggleTheme() {
      var current = document.documentElement.getAttribute('data-theme') || 'dark';
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('da_theme', next); } catch(e) {}
      updateThemeIcon();
    }
    function updateThemeIcon() {
      var btn = document.getElementById('theme-toggle');
      if (!btn) return;
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      btn.textContent = isDark ? '☀️' : '🌙';
      btn.title = isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro';
    }
    document.addEventListener('DOMContentLoaded', updateThemeIcon);
  </script>
  <button id="theme-toggle" class="theme-toggle-float" onclick="toggleTheme()" title="Mudar tema"></button>
  ```

- [ ] **Step 5: Run tests to verify they pass**

  ```bash
  npx jest tests/routes/landing.test.js --no-coverage
  ```

  Expected: all 6 tests PASS (4 existing + 2 new).

- [ ] **Step 6: Run full test suite**

  ```bash
  npm test
  ```

  Expected: all tests pass.

- [ ] **Step 7: Commit**

  ```bash
  git add public/index.html tests/routes/landing.test.js
  git commit -m "feat(theme): add dark/light toggle to landing page"
  ```

---

## Task 3: Dashboard sidebar pages

**Files:**
- Test: `tests/routes/dashboard.test.js`
- Modify: `public/dashboard/index.html`
- Modify: `public/dashboard/historico.html`
- Modify: `public/dashboard/alertas.html`
- Modify: `public/dashboard/configuracoes.html`

- [ ] **Step 1: Write failing test in `tests/routes/dashboard.test.js`**

  Add inside the existing `describe('Dashboard static files', ...)` block:

  ```js
  it('GET /dashboard/ contém botão theme-toggle', async () => {
    const res = await request(app).get('/dashboard/');
    expect(res.text).toContain('id="theme-toggle"');
  });

  it('GET /dashboard/ contém script de inicialização de tema', async () => {
    const res = await request(app).get('/dashboard/');
    expect(res.text).toContain('da_theme');
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  npx jest tests/routes/dashboard.test.js --no-coverage
  ```

  Expected: the 2 new tests FAIL.

- [ ] **Step 3: Modify `public/dashboard/index.html`**

  **3a.** After `<link rel="stylesheet" href="style.css">` (line 7), insert the init script:

  ```html
  <script>
    (function() {
      try {
        var saved = localStorage.getItem('da_theme');
        var sys = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', saved || sys);
      } catch(e) {}
    })();
  </script>
  ```

  **3b.** After `<div class="sidebar-footer" id="user-email">Carregando...</div>` (line 22), insert:

  ```html
      <button id="theme-toggle" class="theme-toggle-sidebar" onclick="toggleTheme()" title="Mudar tema"></button>
  ```

  **3c.** Inside the existing `<script>` block, after the closing `}` of `checkAlertBadge` function (before `</script>`), add:

  ```js
  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('da_theme', next); } catch(e) {}
    updateThemeIcon();
  }
  function updateThemeIcon() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.title = isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro';
  }
  document.addEventListener('DOMContentLoaded', updateThemeIcon);
  ```

- [ ] **Step 4: Run tests to verify dashboard/index passes**

  ```bash
  npx jest tests/routes/dashboard.test.js --no-coverage
  ```

  Expected: all 5 tests PASS.

- [ ] **Step 5: Modify `public/dashboard/historico.html`**

  Apply the same three changes as Step 3 to `historico.html`:
  - Init script after `<link rel="stylesheet" href="style.css">`
  - Sidebar button after `<div class="sidebar-footer" id="user-email">`
  - Toggle functions added to the existing `<script>` block (before `</script>`)

- [ ] **Step 6: Modify `public/dashboard/alertas.html`**

  Apply the same three changes to `alertas.html`.

- [ ] **Step 7: Modify `public/dashboard/configuracoes.html`**

  Apply the same three changes to `configuracoes.html`.

- [ ] **Step 8: Run full test suite**

  ```bash
  npm test
  ```

  Expected: all tests pass.

- [ ] **Step 9: Commit**

  ```bash
  git add public/dashboard/index.html public/dashboard/historico.html public/dashboard/alertas.html public/dashboard/configuracoes.html tests/routes/dashboard.test.js
  git commit -m "feat(theme): add dark/light toggle to dashboard sidebar pages"
  ```

---

## Task 4: Dashboard auth pages (login + signup)

**Files:**
- Test: `tests/routes/signup.test.js`
- Modify: `public/dashboard/login.html`
- Modify: `public/dashboard/signup.html`

- [ ] **Step 1: Write failing test in `tests/routes/signup.test.js`**

  Add inside the existing `describe('Signup page', ...)` block:

  ```js
  it('GET /dashboard/signup.html contém botão theme-toggle', async () => {
    const res = await request(app).get('/dashboard/signup.html');
    expect(res.text).toContain('id="theme-toggle"');
  });

  it('GET /dashboard/signup.html contém script de inicialização de tema', async () => {
    const res = await request(app).get('/dashboard/signup.html');
    expect(res.text).toContain('da_theme');
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  npx jest tests/routes/signup.test.js --no-coverage
  ```

  Expected: the 2 new tests FAIL.

- [ ] **Step 3: Modify `public/dashboard/login.html`**

  **3a.** After `<link rel="stylesheet" href="style.css">` (line 7), insert:

  ```html
  <script>
    (function() {
      try {
        var saved = localStorage.getItem('da_theme');
        var sys = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', saved || sys);
      } catch(e) {}
    })();
  </script>
  ```

  **3b.** Before `</body>` (currently at line 89), insert:

  ```html
  <script>
    function toggleTheme() {
      var current = document.documentElement.getAttribute('data-theme') || 'dark';
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('da_theme', next); } catch(e) {}
      updateThemeIcon();
    }
    function updateThemeIcon() {
      var btn = document.getElementById('theme-toggle');
      if (!btn) return;
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      btn.textContent = isDark ? '☀️' : '🌙';
      btn.title = isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro';
    }
    document.addEventListener('DOMContentLoaded', updateThemeIcon);
  </script>
  <button id="theme-toggle" class="theme-toggle-float" onclick="toggleTheme()" title="Mudar tema"></button>
  ```

- [ ] **Step 4: Modify `public/dashboard/signup.html`**

  Apply the same two changes as Step 3 to `signup.html`:
  - Init script after `<link rel="stylesheet" href="style.css">`
  - Toggle script + floating button before `</body>`

- [ ] **Step 5: Run tests to verify they pass**

  ```bash
  npx jest tests/routes/signup.test.js --no-coverage
  ```

  Expected: all 5 tests PASS (3 existing + 2 new).

- [ ] **Step 6: Run full test suite**

  ```bash
  npm test
  ```

  Expected: all tests pass.

- [ ] **Step 7: Commit**

  ```bash
  git add public/dashboard/login.html public/dashboard/signup.html tests/routes/signup.test.js
  git commit -m "feat(theme): add dark/light toggle to login and signup pages"
  ```

---

## Self-Review

**Spec coverage check:**
- ✅ `[data-theme="light"]` CSS variables in both CSS files — Task 1
- ✅ Init script (IIFE, localStorage + prefers-color-scheme) — Tasks 2, 3, 4
- ✅ Floating button (landing, login, signup) — Tasks 2, 4
- ✅ Sidebar toggle button (dashboard pages) — Task 3
- ✅ `toggleTheme()` + `updateThemeIcon()` — Tasks 2, 3, 4
- ✅ `DOMContentLoaded` → `updateThemeIcon()` — Tasks 2, 3, 4
- ✅ `localStorage` key `da_theme` — all tasks
- ✅ Navbar light override (rgba hardcoded) — Task 1
- ✅ `pricing.html` excluded (out of scope per spec) — correctly not listed

**Placeholder scan:** No TBD, TODO, or vague requirements found.

**Type consistency:** `toggleTheme`, `updateThemeIcon`, `theme-toggle` (id), `da_theme` (localStorage key), `theme-toggle-float` (class), `theme-toggle-sidebar` (class) — consistent across all tasks.
