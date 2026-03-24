# Visual Redesign — DEBUG_Assist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand DevInsight → DEBUG_Assist and apply the Developer Dark visual system to the landing page and all dashboard pages.

**Architecture:** The landing page gets a full rewrite with a new external `public/style.css`. The dashboard shares its existing `public/dashboard/style.css` which gets CSS variable updates. All HTML pages get logo/name references updated. No backend changes.

**Tech Stack:** Vanilla HTML/CSS, Google Fonts (Inter + JetBrains Mono), no build system.

**Spec:** `docs/superpowers/specs/2026-03-23-visual-redesign-design.md`
**Reference mockup:** `public/mockup-landing.html` (approved by user — use as visual reference)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `public/style.css` | Create | Landing page CSS: variables, nav, hero, stats, features, pricing, footer, responsive |
| `public/index.html` | Full rewrite | Landing page HTML: Nav, Hero, Stats, Features, Pricing, Footer |
| `public/dashboard/style.css` | Modify | CSS variables updated to new palette; Google Fonts import added; logo cursor animation added |
| `public/dashboard/index.html` | Modify | Logo/name: DevInsight → DEBUG_Assist; title update |
| `public/dashboard/historico.html` | Modify | Logo/name update; title update |
| `public/dashboard/alertas.html` | Modify | Logo/name update; title update |
| `public/dashboard/login.html` | Modify | Logo/name update; title update |
| `public/dashboard/signup.html` | Modify | Logo/name update; title update |
| `public/dashboard/pricing.html` | Modify | Logo/name update; 100 → 10 diagnósticos/mês; title update |
| `public/docs/sdks.html` | Modify | Prose name update only (no JS identifier changes) |
| `public/mockup-landing.html` | Delete | Cleanup after implementation |

---

## Task 1: Create `public/style.css` (landing page CSS)

**Files:**
- Create: `public/style.css`

- [ ] **Step 1: Verify there is no existing `public/style.css`**

```bash
ls public/style.css 2>/dev/null && echo "EXISTS" || echo "NOT FOUND"
```
Expected: `NOT FOUND`

- [ ] **Step 2: Create `public/style.css`**

Create the file with the full CSS below. This is the complete landing page stylesheet — do NOT inline styles in `index.html`.

```css
/* public/style.css — DEBUG_Assist landing page */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:        #0F172A;
  --surface:   #1E293B;
  --border:    #334155;
  --accent:    #6366F1;
  --accent-h:  #4F46E5;
  --text:      #F8FAFC;
  --muted:     #94A3B8;
  --green:     #4ADE80;
  --red:       #F87171;
  --code-bg:   #0D1117;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  min-height: 100vh;
  line-height: 1.6;
}

a { color: inherit; text-decoration: none; }

/* ── Logo cursor ─────────────────────────── */
.logo-debug { color: var(--accent); font-family: 'JetBrains Mono', monospace; font-weight: 700; }
.logo-cursor {
  display: inline-block;
  width: 2px; height: 1em;
  background: var(--accent);
  margin-left: 1px;
  vertical-align: middle;
  animation: blink 1s step-end infinite;
}
@keyframes blink { 50% { opacity: 0; } }

/* ── Navigation ──────────────────────────── */
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 64px;
  border-bottom: 1px solid var(--border);
  position: sticky; top: 0;
  background: rgba(15,23,42,0.92);
  backdrop-filter: blur(12px);
  z-index: 100;
}
.nav-logo {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 18px;
  font-weight: 500;
}
.nav-links { display: flex; align-items: center; gap: 32px; }
.nav-links a { color: var(--muted); font-size: 14px; transition: color .15s; }
.nav-links a:hover { color: var(--text); }

/* ── Buttons ─────────────────────────────── */
.btn-primary {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s;
  display: inline-block;
}
.btn-primary:hover { background: var(--accent-h); }
.btn-nav {
  background: var(--accent);
  color: #fff !important;
  border-radius: 6px;
  padding: 8px 18px;
  font-size: 14px;
  font-weight: 600;
  transition: background .15s;
}
.btn-nav:hover { background: var(--accent-h) !important; }
.btn-outline {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color .15s, background .15s;
  display: inline-block;
}
.btn-outline:hover { border-color: var(--muted); background: rgba(255,255,255,0.03); }

/* ── Hero ────────────────────────────────── */
.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
  padding: 96px 64px 80px;
}
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(99,102,241,0.12);
  border: 1px solid rgba(99,102,241,0.3);
  border-radius: 20px;
  padding: 5px 14px;
  font-size: 12px;
  color: #a5b4fc;
  margin-bottom: 24px;
  font-weight: 500;
}
.hero h1 {
  font-size: 64px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -1.5px;
  margin-bottom: 20px;
}
.hero h1 .accent { color: var(--accent); }
.hero-sub {
  font-size: 17px;
  color: var(--muted);
  line-height: 1.7;
  margin-bottom: 36px;
  max-width: 480px;
}
.hero-btns { display: flex; gap: 12px; align-items: center; margin-bottom: 32px; }
.hero-trust { display: flex; gap: 20px; font-size: 12px; color: var(--muted); flex-wrap: wrap; }
.hero-trust span { display: flex; align-items: center; gap: 5px; }
.hero-trust .check { color: var(--green); }

/* ── Code block ──────────────────────────── */
.code-block {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  box-shadow: 0 24px 48px rgba(0,0,0,0.4);
}
.code-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: #161b22;
}
.code-dot { width: 10px; height: 10px; border-radius: 50%; }
.code-dot.red    { background: #ff5f57; }
.code-dot.yellow { background: #ffbd2e; }
.code-dot.green  { background: #28c840; }
.code-filename { color: var(--muted); font-size: 12px; margin-left: 8px; }
.code-body { padding: 20px 24px; line-height: 1.8; }
.c-comment { color: #6e7681; }
.c-keyword { color: #ff7b72; }
.c-string  { color: #a5d6ff; }
.c-num     { color: #79c0ff; }
.c-key     { color: #7ee787; }
.c-accent  { color: #d2a8ff; }
.c-badge {
  display: inline-block;
  background: rgba(248,113,113,0.15);
  color: var(--red);
  border: 1px solid rgba(248,113,113,0.3);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 700;
  margin-left: 8px;
}
.c-badge.green {
  background: rgba(74,222,128,0.1);
  color: var(--green);
  border-color: rgba(74,222,128,0.25);
}

/* ── Stats bar ───────────────────────────── */
.stats-wrap { max-width: 1200px; margin: 0 auto; padding: 0 64px 80px; }
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
}
.stat { background: var(--surface); padding: 32px 24px; text-align: center; }
.stat-num   { font-size: 36px; font-weight: 800; color: var(--accent); }
.stat-label { font-size: 13px; color: var(--muted); margin-top: 4px; }

/* ── Features ────────────────────────────── */
.features {
  max-width: 1200px;
  margin: 0 auto;
  padding: 80px 64px;
  border-top: 1px solid var(--border);
}
.section-label {
  text-align: center;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--accent);
  font-weight: 600;
  margin-bottom: 12px;
}
.features h2, .pricing h2 {
  text-align: center;
  font-size: 40px;
  font-weight: 800;
  letter-spacing: -1px;
  margin-bottom: 12px;
}
.section-sub {
  text-align: center;
  color: var(--muted);
  font-size: 16px;
  max-width: 520px;
  margin: 0 auto 56px;
  line-height: 1.6;
}
.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.feature-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  transition: border-color .2s;
}
.feature-card:hover { border-color: var(--accent); }
.feature-icon {
  width: 40px; height: 40px;
  background: rgba(99,102,241,0.12);
  border: 1px solid rgba(99,102,241,0.2);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  margin-bottom: 16px;
}
.feature-card h3 { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
.feature-card p  { font-size: 13px; color: var(--muted); line-height: 1.6; }

/* ── Pricing ─────────────────────────────── */
.pricing {
  max-width: 1200px;
  margin: 0 auto;
  padding: 80px 64px;
  border-top: 1px solid var(--border);
}
.pricing h2 { margin-bottom: 48px; }
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.pricing-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 28px;
  position: relative;
}
.pricing-card.featured {
  border-color: var(--accent);
  background: rgba(99,102,241,0.06);
}
.pricing-badge {
  position: absolute;
  top: -12px; left: 50%;
  transform: translateX(-50%);
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 12px;
  border-radius: 20px;
  white-space: nowrap;
}
.plan-name  { font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 8px; }
.plan-price { font-size: 40px; font-weight: 800; margin-bottom: 4px; }
.plan-price span { font-size: 16px; font-weight: 400; color: var(--muted); }
.plan-limit { font-size: 13px; color: var(--muted); margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid var(--border); }
.plan-features { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
.plan-features li { font-size: 13px; color: var(--muted); display: flex; align-items: center; gap: 8px; }
.plan-features li::before { content: '✓'; color: var(--green); font-weight: 700; }
.btn-plan-primary {
  display: block; text-align: center;
  background: var(--accent); color: #fff;
  border: none; border-radius: 8px;
  padding: 12px 24px; font-size: 14px; font-weight: 600;
  cursor: pointer; transition: background .15s; text-decoration: none;
}
.btn-plan-primary:hover { background: var(--accent-h); }
.btn-plan-outline {
  display: block; text-align: center;
  background: transparent; color: var(--text);
  border: 1px solid var(--border); border-radius: 8px;
  padding: 12px 24px; font-size: 14px; font-weight: 500;
  cursor: pointer; transition: border-color .15s, background .15s; text-decoration: none;
}
.btn-plan-outline:hover { border-color: var(--muted); background: rgba(255,255,255,0.03); }

/* ── Footer ──────────────────────────────── */
footer {
  border-top: 1px solid var(--border);
  padding: 40px 64px;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--muted);
  font-size: 13px;
}
footer .footer-logo { font-family: 'JetBrains Mono', monospace; font-weight: 500; color: var(--text); }
footer .footer-links { display: flex; gap: 24px; }
footer .footer-links a { color: var(--muted); transition: color .15s; }
footer .footer-links a:hover { color: var(--text); }

/* ── Responsive ──────────────────────────── */
@media (max-width: 768px) {
  .navbar { padding: 16px 20px; }
  .nav-links a:not(.btn-nav) { display: none; }

  .hero {
    grid-template-columns: 1fr;
    padding: 60px 20px 48px;
    gap: 40px;
  }
  .hero h1 { font-size: 40px; }

  .stats-wrap { padding: 0 20px 48px; }
  .stats { grid-template-columns: repeat(2, 1fr); }

  .features { padding: 60px 20px; }
  .features-grid { grid-template-columns: 1fr; }
  .features h2, .pricing h2 { font-size: 28px; }

  .pricing { padding: 60px 20px; }
  .pricing-grid { grid-template-columns: 1fr; }

  footer { padding: 32px 20px; flex-direction: column; gap: 16px; text-align: center; }
  footer .footer-links { justify-content: center; }
}
```

- [ ] **Step 3: Verify file was created**

```bash
ls -la public/style.css
```
Expected: file exists with non-zero size.

- [ ] **Step 4: Commit**

```bash
git add public/style.css
git commit -m "feat: add landing page CSS with Developer Dark visual system"
```

---

## Task 2: Rewrite `public/index.html`

**Files:**
- Modify: `public/index.html` (full rewrite)

- [ ] **Step 1: Verify current state has DevInsight references**

```bash
grep -c "DevInsight" public/index.html
```
Expected: number > 0

- [ ] **Step 2: Rewrite `public/index.html`**

Replace the entire file with the following. Note: CSS is in external `public/style.css`, not inline.

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DEBUG_Assist — Diagnóstico de APIs para devs</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css">
</head>
<body>

<!-- NAV -->
<nav class="navbar">
  <a href="/" class="nav-logo">
    <span class="logo-debug">DEBUG_</span><span>Assist</span><span class="logo-cursor"></span>
  </a>
  <div class="nav-links">
    <a href="/docs">Docs</a>
    <a href="/docs/sdks.html">SDK</a>
    <a href="#pricing">Preços</a>
    <a href="/dashboard/login.html">Entrar</a>
    <a href="/dashboard/signup.html" class="btn-nav">Começar grátis</a>
  </div>
</nav>

<!-- HERO -->
<section class="hero">
  <div>
    <div class="hero-badge">⚡ Diagnóstico de erros em tempo real</div>
    <h1>
      Entenda seus erros.<br>
      <span class="accent">Antes</span> que o usuário<br>
      perceba.
    </h1>
    <p class="hero-sub">
      DEBUG_Assist analisa suas requisições, logs e queries em tempo real —
      e devolve causa, severidade e solução em milissegundos.
    </p>
    <div class="hero-btns">
      <a class="btn-primary" href="/dashboard/signup.html">Começar grátis →</a>
      <a class="btn-outline" href="/docs">Ver documentação</a>
    </div>
    <div class="hero-trust">
      <span><span class="check">✓</span> Sem cartão de crédito</span>
      <span><span class="check">✓</span> 10 diagnósticos grátis</span>
      <span><span class="check">✓</span> Integração em 5 min</span>
    </div>
  </div>

  <div class="code-block">
    <div class="code-header">
      <div class="code-dot red"></div>
      <div class="code-dot yellow"></div>
      <div class="code-dot green"></div>
      <span class="code-filename">api-monitor.js</span>
    </div>
    <div class="code-body">
      <div><span class="c-comment">// Integração em 3 linhas</span></div>
      <div><span class="c-keyword">import</span> <span class="c-accent">DebugAssist</span> <span class="c-keyword">from</span> <span class="c-string">'@debug-assist/node'</span></div>
      <div>&nbsp;</div>
      <div><span class="c-accent">DebugAssist</span>.<span class="c-key">init</span>({ <span class="c-key">apiKey</span>: <span class="c-string">'da_live_...'</span> })</div>
      <div>&nbsp;</div>
      <div><span class="c-comment">// Diagnóstico retornado automaticamente:</span></div>
      <div>{</div>
      <div>&nbsp;&nbsp;<span class="c-key">"problema"</span>: <span class="c-string">"N+1 query detectada"</span>,<span class="c-badge">alto</span></div>
      <div>&nbsp;&nbsp;<span class="c-key">"causa"</span>: <span class="c-string">"Loop sem eager loading"</span>,</div>
      <div>&nbsp;&nbsp;<span class="c-key">"sugestoes"</span>: [<span class="c-string">"Use JOIN ou include()"</span>],</div>
      <div>&nbsp;&nbsp;<span class="c-key">"confianca"</span>: <span class="c-num">0.94</span><span class="c-badge green">✓ 94%</span></div>
      <div>}</div>
    </div>
  </div>
</section>

<!-- STATS -->
<div class="stats-wrap">
  <div class="stats">
    <div class="stat"><div class="stat-num">2.4M+</div><div class="stat-label">Diagnósticos processados</div></div>
    <div class="stat"><div class="stat-num">&lt; 80ms</div><div class="stat-label">Tempo médio de resposta</div></div>
    <div class="stat"><div class="stat-num">94%</div><div class="stat-label">Precisão nos diagnósticos</div></div>
    <div class="stat"><div class="stat-num">99.9%</div><div class="stat-label">Uptime SLA</div></div>
  </div>
</div>

<!-- FEATURES -->
<section class="features">
  <div class="section-label">Capacidades</div>
  <h2>Tudo que você precisa para debugar mais rápido</h2>
  <p class="section-sub">Da captura automática ao diagnóstico com IA — sem configuração complexa.</p>
  <div class="features-grid">
    <div class="feature-card">
      <div class="feature-icon">🔍</div>
      <h3>Diagnóstico de Backend</h3>
      <p>Detecta exceções silenciosas, violações de contrato de API e falhas de integração antes que impactem usuários.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">🗄️</div>
      <h3>Análise de SQL</h3>
      <p>Identifica queries N+1, índices ausentes, queries lentas e riscos de injeção automaticamente.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">🌐</div>
      <h3>Monitoramento Frontend</h3>
      <p>Captura erros de hidratação, falhas silenciosas e problemas de performance no browser.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">⚡</div>
      <h3>SDK em 3 linhas</h3>
      <p>Node.js, Browser, React, Vue, Svelte. Integre em qualquer stack em menos de 5 minutos.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">🔔</div>
      <h3>Alertas Críticos</h3>
      <p>Dashboard com alertas em tempo real. Polling automático para você nunca perder um erro alto.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">📊</div>
      <h3>Histórico e Contexto</h3>
      <p>Cada diagnóstico vem com causa raiz, sugestões de correção e nível de confiança da IA.</p>
    </div>
  </div>
</section>

<!-- PRICING -->
<section class="pricing" id="pricing">
  <div class="section-label">Preços</div>
  <h2>Simples e previsível</h2>
  <div class="pricing-grid">
    <div class="pricing-card">
      <div class="plan-name">Free</div>
      <div class="plan-price">R$ 0<span>/mês</span></div>
      <div class="plan-limit">10 diagnósticos/mês</div>
      <ul class="plan-features">
        <li>Dashboard completo</li>
        <li>SDK Node.js + Browser</li>
        <li>Histórico 30 dias</li>
        <li>Alertas críticos</li>
      </ul>
      <a class="btn-plan-outline" href="/dashboard/signup.html">Começar grátis</a>
    </div>
    <div class="pricing-card featured">
      <div class="pricing-badge">Mais popular</div>
      <div class="plan-name">Pro</div>
      <div class="plan-price">R$ 49<span>/mês</span></div>
      <div class="plan-limit">1.000 diagnósticos/mês</div>
      <ul class="plan-features">
        <li>Tudo do Free</li>
        <li>Histórico ilimitado</li>
        <li>Suporte prioritário</li>
        <li>Rate limit aumentado</li>
      </ul>
      <a class="btn-plan-primary" href="/dashboard/signup.html">Assinar Pro</a>
    </div>
    <div class="pricing-card">
      <div class="plan-name">Scale</div>
      <div class="plan-price">R$ 149<span>/mês</span></div>
      <div class="plan-limit">10.000 diagnósticos/mês</div>
      <ul class="plan-features">
        <li>Tudo do Pro</li>
        <li>SLA 99.9%</li>
        <li>Webhooks</li>
        <li>Onboarding dedicado</li>
      </ul>
      <a class="btn-plan-outline" href="/dashboard/signup.html">Assinar Scale</a>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer>
  <span class="footer-logo">DEBUG_Assist</span>
  <span>© 2026 · Diagnóstico de APIs para devs</span>
  <div class="footer-links">
    <a href="/docs">Docs</a>
    <a href="/docs/sdks.html">SDK</a>
    <a href="mailto:contato@debugassist.com">Suporte</a>
  </div>
</footer>

</body>
</html>
```

- [ ] **Step 3: Verify no DevInsight references remain**

```bash
grep -c "DevInsight" public/index.html
```
Expected: `0`

- [ ] **Step 4: Verify free plan shows 10 diagnósticos**

```bash
grep "10 diagnósticos" public/index.html
```
Expected: line with `10 diagnósticos/mês`

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat: rewrite landing page with DEBUG_Assist visual redesign"
```

---

## Task 3: Update `public/dashboard/style.css`

**Files:**
- Modify: `public/dashboard/style.css`

This task updates the dashboard's shared stylesheet to use the new CSS variables and adds the Google Fonts import + logo cursor animation. The existing component structure is preserved — only variables, colors, and font references change.

- [ ] **Step 1: Verify current background color is the old value**

```bash
grep "background: #0d0d0d" public/dashboard/style.css
```
Expected: at least one match

- [ ] **Step 2: Add Google Fonts import and CSS variables at the top of the file**

Add these lines at the very top of `public/dashboard/style.css` (before the existing `*, *::before` reset):

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg:         #0F172A;
  --surface:    #1E293B;
  --border:     #334155;
  --accent:     #6366F1;
  --accent-h:   #4F46E5;
  --text:       #F8FAFC;
  --muted:      #94A3B8;
  --green:      #4ADE80;
  --red:        #F87171;
  --code-bg:    #0D1117;
  --nav-active: rgba(99,102,241,0.12);
}

```

- [ ] **Step 3: Update body styles**

Replace:
```css
body {
  background: #0d0d0d;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-height: 100vh;
}
```
With:
```css
body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-height: 100vh;
}
```

- [ ] **Step 4: Update sidebar styles**

Replace (partial block — only the first two property lines change; remaining properties like `padding`, `display` etc. are preserved):
```css
.sidebar {
  width: 200px;
  background: #111;
  border-right: 1px solid #222;
```
With:
```css
.sidebar {
  width: 200px;
  background: var(--surface);
  border-right: 1px solid var(--border);
```

- [ ] **Step 5: Update nav-item active state**

Replace:
```css
.nav-item.active { background: #1e1e2e; color: #fff; }
```
With:
```css
.nav-item.active { background: var(--nav-active); color: var(--text); }
```

- [ ] **Step 6: Update card styles**

Replace:
```css
.card {
  background: #111;
  border: 1px solid #222;
```
With:
```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
```

- [ ] **Step 7: Update usage bar**

Replace:
```css
.usage-bar { background: #222; border-radius: 4px; height: 6px; margin-top: 12px; }
```
With:
```css
.usage-bar { background: var(--border); border-radius: 4px; height: 6px; margin-top: 12px; }
```

- [ ] **Step 8: Update history item styles**

Replace:
```css
.history-item {
  background: #111;
  border: 1px solid #222;
```
With:
```css
.history-item {
  background: var(--surface);
  border: 1px solid var(--border);
```

- [ ] **Step 9: Update alert item styles**

Replace:
```css
.alert-item {
  background: #111;
  border: 1px solid #2a1010;
```
With:
```css
.alert-item {
  background: var(--surface);
  border: 1px solid #2a1010;
```

Also replace:
```css
.alert-stat {
  background: #111;
  border: 1px solid #2a1010;
```
With:
```css
.alert-stat {
  background: var(--surface);
  border: 1px solid #2a1010;
```

- [ ] **Step 10: Update login card**

Replace:
```css
.login-card {
  background: #111;
  border: 1px solid #222;
```
With:
```css
.login-card {
  background: var(--surface);
  border: 1px solid var(--border);
```

- [ ] **Step 11: Update input backgrounds**

Replace (partial block — only the two property lines change; remaining properties like `border-radius`, `padding` etc. are preserved):
```css
input[type="email"], input[type="password"] {
  width: 100%;
  background: #0d0d0d;
  border: 1px solid #333;
```
With:
```css
input[type="email"], input[type="password"] {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
```

- [ ] **Step 12: Add logo cursor animation at end of file**

Append to the end of `public/dashboard/style.css`:
```css

/* ── Logo cursor ─────────────────────────── */
.logo-debug { color: var(--accent); font-family: 'JetBrains Mono', monospace; font-weight: 700; }
.logo-cursor {
  display: inline-block;
  width: 2px; height: 1em;
  background: var(--accent);
  margin-left: 1px;
  vertical-align: middle;
  animation: blink 1s step-end infinite;
}
@keyframes blink { 50% { opacity: 0; } }
.sidebar-logo { display: flex; align-items: center; gap: 2px; padding: 8px 10px; margin-bottom: 12px; }
```

- [ ] **Step 13: Update detail-code background**

Replace:
```css
.detail-code {
  background: #0d0d0d;
```
With:
```css
.detail-code {
  background: var(--code-bg);
```

- [ ] **Step 14: Update apikey-field background**

Replace:
```css
.apikey-field {
  flex: 1;
  background: #0d0d0d;
  border: 1px solid #333;
```
With:
```css
.apikey-field {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--border);
```

- [ ] **Step 15: Verify key variable references are present**

```bash
grep -c "var(--" public/dashboard/style.css
```
Expected: number > 10

- [ ] **Step 16: Commit**

```bash
git add public/dashboard/style.css
git commit -m "feat: update dashboard CSS to Developer Dark visual system"
```

---

## Task 4: Update dashboard HTML pages (logo + name)

**Files:**
- Modify: `public/dashboard/index.html`
- Modify: `public/dashboard/historico.html`
- Modify: `public/dashboard/alertas.html`
- Modify: `public/dashboard/login.html`
- Modify: `public/dashboard/signup.html`
- Modify: `public/dashboard/pricing.html`

The sidebar logo pattern in `index.html`, `historico.html`, and `alertas.html` currently is:
```html
<div class="sidebar-logo">
  <div class="logo-dot"></div>
  <span class="logo-text">DevInsight</span>
</div>
```
Replace with:
```html
<div class="sidebar-logo">
  <span class="logo-debug">DEBUG_</span><span>Assist</span><span class="logo-cursor"></span>
</div>
```

The login card logo in `login.html` and `signup.html` currently is:
```html
<div class="logo">
  <div class="logo-dot"></div>
  <span class="logo-text">DevInsight</span>
</div>
```
Replace with:
```html
<div class="logo">
  <span class="logo-debug">DEBUG_</span><span>Assist</span><span class="logo-cursor"></span>
</div>
```

The `pricing.html` logo currently is:
```html
<div class="logo" style="text-align:center;margin-bottom:32px;">
  <a href="/dashboard/" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;">
    <div class="logo-dot"></div>
    <span class="logo-text">DevInsight</span>
  </a>
</div>
```
Replace with:
```html
<div class="logo" style="text-align:center;margin-bottom:32px;">
  <a href="/dashboard/" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
    <span class="logo-debug">DEBUG_</span><span>Assist</span><span class="logo-cursor"></span>
  </a>
</div>
```

- [ ] **Step 1: Update `<title>` tags in all 6 files**

For each file, replace `DevInsight` in the `<title>` tag:

- `index.html`: `<title>Dashboard — DevInsight</title>` → `<title>Dashboard — DEBUG_Assist</title>`
- `historico.html`: `<title>Histórico — DevInsight</title>` → `<title>Histórico — DEBUG_Assist</title>`
- `alertas.html`: `<title>Alertas — DevInsight</title>` → `<title>Alertas — DEBUG_Assist</title>`
- `login.html`: `<title>Login — DevInsight</title>` → `<title>Login — DEBUG_Assist</title>`
- `signup.html`: `<title>Criar conta — DevInsight</title>` → `<title>Criar conta — DEBUG_Assist</title>`
- `pricing.html`: `<title>Planos — DevInsight</title>` → `<title>Planos — DEBUG_Assist</title>`

- [ ] **Step 2: Update sidebar logos in `index.html`, `historico.html`, `alertas.html`**

In each file, replace the sidebar-logo block as described above.

- [ ] **Step 3: Update login card logos in `login.html` and `signup.html`**

Replace the `.logo` block as described above.

- [ ] **Step 4: Update logo in `pricing.html`**

Replace the pricing logo block as described above. Also update the free plan limit:
```html
<div class="plan-limit">100 diagnósticos/mês</div>
```
→
```html
<div class="plan-limit">10 diagnósticos/mês</div>
```

- [ ] **Step 5: Verify no DevInsight text references remain in dashboard HTML**

```bash
grep -rn "DevInsight" public/dashboard/
```
Expected: only matches inside `<script>` blocks with JS variable names like `devinsight_token` (these are localStorage key names — do NOT change them, they would break existing sessions).

**Important:** Do NOT rename `devinsight_token`, `devinsight_email`, `devinsight_last_alert_seen` — these are internal localStorage keys, not user-visible text.

- [ ] **Step 6: Commit**

```bash
git add public/dashboard/index.html public/dashboard/historico.html public/dashboard/alertas.html public/dashboard/login.html public/dashboard/signup.html public/dashboard/pricing.html
git commit -m "feat: rebrand dashboard pages DevInsight → DEBUG_Assist"
```

---

## Task 5: Update `public/docs/sdks.html`

**Files:**
- Modify: `public/docs/sdks.html`

Update prose text, page title, and nav logo references only. Do NOT rename `window.DevInsight`, `DevInsight.init()`, or any JavaScript identifiers — those are the public SDK API surface.

- [ ] **Step 1: Check current DevInsight references**

```bash
grep -n "DevInsight" public/docs/sdks.html | head -30
```
Note the line numbers. Identify which are:
- Text/prose references (update these)
- JS identifiers like `window.DevInsight`, `DevInsight.init()` (leave these)

- [ ] **Step 2: Update `<title>` tag**

Replace: `DevInsight` in the title with `DEBUG_Assist`

- [ ] **Step 3: Update nav logo**

Replace the nav logo HTML (same pattern as other pages): replace `<div class="logo-dot"></div><span class="logo-text">DevInsight</span>` with `<span class="logo-debug">DEBUG_</span><span>Assist</span><span class="logo-cursor"></span>`

- [ ] **Step 4: Update prose text references**

Replace prose occurrences of "DevInsight" in body text (descriptions, headings, paragraphs) with "DEBUG_Assist". Skip any occurrence inside `<code>`, `<pre>`, or `<script>` blocks that are part of code examples showing `window.DevInsight` or `DevInsight.init()`.

- [ ] **Step 5: Verify JS identifiers are untouched**

```bash
grep -c "window\.DevInsight\|DevInsight\.init\|DevInsight\.report" public/docs/sdks.html
```
Expected: `5` (the baseline count — if you get less, you accidentally renamed a JS identifier; revert).

- [ ] **Step 6: Commit**

```bash
git add public/docs/sdks.html
git commit -m "feat: update sdks.html branding to DEBUG_Assist"
```

---

## Task 6: Final verification and cleanup

**Files:**
- Delete: `public/mockup-landing.html`

- [ ] **Step 1: Final check — no DevInsight in public HTML titles or visible text**

```bash
grep -rn "DevInsight" public/*.html public/dashboard/*.html public/docs/*.html 2>/dev/null
```
Expected: zero matches (or only JS variable names inside `<script>` blocks like `devinsight_token`)

- [ ] **Step 2: Verify free plan limit is 10 everywhere**

```bash
grep -rn "100 diagnósticos" public/
```
Expected: zero matches

- [ ] **Step 3: Verify Google Fonts loads in both landing page and dashboard**

```bash
grep -l "fonts.googleapis.com" public/index.html public/dashboard/style.css
```
Expected: both files listed

- [ ] **Step 4: Delete mockup file**

```bash
rm public/mockup-landing.html
```

- [ ] **Step 5: Final commit**

```bash
git add -u
git commit -m "chore: remove landing page mockup, visual redesign complete"
```
Note: `git add -u` stages only tracked file changes and deletions — avoids accidentally staging the many untracked directories in this repo.

- [ ] **Step 6: Push to remote**

```bash
git push origin master
```
Render will auto-deploy from this push.
