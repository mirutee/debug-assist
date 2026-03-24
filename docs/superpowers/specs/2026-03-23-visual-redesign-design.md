# Visual Redesign — DEBUG_Assist

**Date:** 2026-03-23
**Scope:** Landing page + Dashboard (starting with landing page)
**Design direction:** Developer Dark (Approach B)

---

## 1. Rebranding

- Product name changes from **DevInsight** to **DEBUG_Assist**
- Tagline: *"Diagnóstico de APIs para devs"*
- Logo: `DEBUG_` in JetBrains Mono bold (accent color) + `Assist` in Inter regular; blinking cursor appended:
  ```css
  .cursor { display: inline-block; width: 2px; height: 1em;
            background: var(--accent); margin-left: 1px;
            animation: blink 1s step-end infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  ```
- All user-facing text, page titles, meta tags, and nav must reflect the new name
- `DevInsight` identifiers inside `public/sdk/browser.js` and SDK code examples in `public/docs/sdks.html` are **out of scope** — renaming them is a breaking SDK API change

---

## 2. Visual System

### Color Palette
```
--bg:        #0F172A   /* page background */
--surface:   #1E293B   /* cards, sidebar, nav */
--border:    #334155   /* dividers, card borders */
--accent:    #6366F1   /* primary CTA, highlights */
--accent-h:  #4F46E5   /* accent hover */
--text:      #F8FAFC   /* primary text */
--muted:     #94A3B8   /* secondary text, labels */
--green:     #4ADE80   /* success, low severity */
--red:       #F87171   /* alerts, high severity */
--code-bg:   #0D1117   /* code block background */
--nav-active: rgba(99,102,241,0.12) /* active nav item background — dashboard only, not needed in public/style.css */
```

### Typography
- **Inter** loaded via Google Fonts:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  ```
- **Headlines:** Inter 700–800, -1px to -1.5px letter-spacing
  - Hero H1: 64px
  - Section H2: 40px
  - Card H3: 15px
- **Body:** Inter 400, 15–16px, line-height 1.7
- **Labels/badges:** Inter 600, 11–12px, uppercase, letter-spacing 1–2px
- **Code:** JetBrains Mono 400–500, 13px

### Components
- **Buttons:**
  - Primary: `background: var(--accent)`, white text, border-radius 8px, padding 12px 24px; hover: `background: var(--accent-h)`
  - Outline: transparent background, `border: 1px solid var(--border)`, border-radius 8px; hover: `border-color: var(--muted); background: rgba(255,255,255,0.03)`
- **Cards:** `background: var(--surface)`, `border: 1px solid var(--border)`, border-radius 12px; hover: `border-color: var(--accent)`
- **Badges:** `background: rgba(99,102,241,0.12)`, `border: 1px solid rgba(99,102,241,0.3)`, border-radius 20px
- **Code blocks:** `background: var(--code-bg)`, `border: 1px solid var(--border)`, border-radius 12px, macOS traffic-light dots header

---

## 3. Landing Page Structure

The landing page CSS must be extracted to `public/style.css` (not inline) for consistency with the dashboard pattern.

### 3.1 Navigation (sticky)
- Logo left: `DEBUG_Assist` with blinking cursor (see Section 1)
- Links: Docs · SDK · Preços · Login
- CTA right: `Começar grátis` (filled accent button)
- Background: `rgba(15,23,42,0.92)` + `backdrop-filter: blur(12px)` when scrolled

### 3.2 Hero (two-column grid)
**Left column:**
- Badge: `⚡ Diagnóstico de erros em tempo real` (accent badge style)
- H1 (64px, 800): "Entenda seus erros. **Antes** que o usuário perceba." — "Antes" in `var(--accent)`
- Subtitle (17px, muted): description of DEBUG_Assist value prop
- Two buttons: `Começar grátis →` (primary) + `Ver documentação` (outline)
- Trust row: ✓ Sem cartão de crédito · ✓ 10 diagnósticos grátis · ✓ Integração em 5 min

**Right column:**
- Syntax-highlighted code block (JetBrains Mono, `var(--code-bg)` background)
- Shows 3-line integration + JSON diagnostic response
- Severity badge `alto` in red, confidence badge `✓ 94%` in green inline with JSON
- macOS traffic-light dots + filename `api-monitor.js` in header

### 3.3 Stats Bar
- 4-column grid with `gap: 1px` on container with `background: var(--border)`; each cell has `background: var(--surface)` — the gap color creates the divider lines
- Stats: `2.4M+ diagnósticos` · `< 80ms resposta` · `94% precisão` · `99.9% uptime`
- Numbers in `var(--accent)` (36px, 800); labels in `var(--muted)` (13px)

### 3.4 Features Grid (3×2)
- Section label: "CAPACIDADES" (uppercase, `var(--accent)`, letter-spacing 2px)
- H2: "Tudo que você precisa para debugar mais rápido"
- 6 cards: Backend · SQL · Frontend · SDK · Alertas · Histórico
- Each card: emoji icon in accent-tinted rounded box (`background: rgba(99,102,241,0.12)`), H3, description

### 3.5 Pricing (3 cards)
- Plans: Free (R$0) · Pro (R$49) · Scale (R$149)
- Free: **10 diagnósticos/mês**
- Pro: 1.000 diagnósticos/mês — featured card: `border-color: var(--accent)`, `background: rgba(99,102,241,0.06)`, "Mais popular" badge (accent filled pill, `position: absolute; top: -12px`)
- Scale: 10.000 diagnósticos/mês
- Each card: plan name, price, limit, feature list (✓ in `var(--green)`), CTA button

### 3.6 Footer
- Logo left · tagline center · links right (Docs · API · Suporte)
- `border-top: 1px solid var(--border)`

---

## 4. Responsive Breakpoints

At **768px** and below:
- Hero two-column grid collapses to single column (code block below text)
- Stats bar 4-column grid collapses to 2×2
- Features grid 3-column collapses to single column
- Pricing grid 3-column collapses to single column
- Nav links hidden; logo + CTA button only
- Padding reduced from 64px to 20px on all sections

---

## 5. Dashboard Redesign

Apply the same visual system to all dashboard pages:

### 5.1 Sidebar
- Background: `var(--surface)`
- Logo with blinking cursor at top (same as landing page)
- Nav items: `var(--muted)` by default; active: `color: var(--text)`, `background: var(--nav-active)`
- Alert badge: red pill on Alertas nav item
- User email at bottom in `var(--muted)`

### 5.2 Cards & Metrics
- Replace `#111` background with `var(--surface)`
- Replace `#222` borders with `var(--border)`
- Usage bar fill: `var(--accent)` on `var(--border)` track
- Plan badge: `var(--accent)` color, 20px, 700 weight

### 5.3 History & Alerts Lists
- Items: `var(--surface)` background, `var(--border)` border, border-radius 12px
- Severity badges: keep existing green/yellow/red logic, adjusted to new palette
- Code blocks (contexto): use `var(--code-bg)` with JetBrains Mono

### 5.4 Typography & Spacing
- Page titles: 24px, weight 700
- Consistent 32px padding on `.main`
- Section labels use uppercase tracking pattern from landing page

---

## 6. Files to Create / Modify

### Landing page
- `public/index.html` — full rewrite: new structure, name, Google Fonts link
- `public/style.css` — new CSS variables and components (external file, not inline)

### Dashboard
- `public/dashboard/style.css` — update CSS variables, card styles, typography, add Google Fonts
- `public/dashboard/index.html` — update logo/name references
- `public/dashboard/historico.html` — update logo/name references
- `public/dashboard/alertas.html` — update logo/name references
- `public/dashboard/login.html` — update logo/name references
- `public/dashboard/signup.html` — update logo/name references
- `public/dashboard/pricing.html` — update logo/name references

### Docs
- `public/docs/sdks.html` — update page title, nav logo, and prose references from DevInsight → DEBUG_Assist; **do not rename** JS identifiers (`window.DevInsight`, etc.) — SDK API compatibility

### Cleanup
- Delete `public/mockup-landing.html` after implementation is verified

---

## 7. Out of Scope

- No changes to backend routes or API logic
- No changes to `sdk/` source files
- No renaming of JS identifiers in `public/sdk/browser.js` (public SDK API — breaking change)
- No changes to `swagger.yaml` branding (separate task)
- No new pages (Angular/Next.js/React Native adapters are a separate task)

---

## 8. Success Criteria

- Landing page matches mockup approved on 2026-03-23 (at `public/mockup-landing.html`)
- All dashboard pages consistently use the new color palette and typography
- `DEBUG_Assist` name appears everywhere `DevInsight` previously appeared in HTML text/titles
- No remaining `DevInsight` text references in public-facing `.html` or `.css` files (JS identifiers excepted per Section 7)
- Hero two-column layout stacks vertically on screens ≤ 768px without horizontal scroll
- Free plan shows **10 diagnósticos/mês** everywhere
