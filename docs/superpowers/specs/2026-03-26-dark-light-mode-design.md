# Dark/Light Mode — Design

**Data:** 2026-03-26
**Fase:** Tema claro/escuro em todo o site (landing + dashboard)
**Status:** Aprovado

---

## Contexto

O site usa 100% dark theme com CSS variables em `:root`. Esta fase adiciona suporte a light mode via `data-theme` attribute no `<html>`, sem alterar a estrutura de nenhuma página.

---

## Decisões de Design

| Decisão | Motivo |
|---|---|
| `data-theme` no `<html>` | Padrão da indústria; CSS `[data-theme="light"]` sobrescreve `:root` sem conflito |
| Script inline no `<head>` | Evita flash de tema errado (FOUC) ao carregar a página |
| `localStorage` para persistência | Zero servidor; persiste entre sessões |
| `prefers-color-scheme` como padrão | Respeita preferência do sistema quando não há override salvo |
| Botão flutuante na landing / login / signup / pricing | Páginas sem sidebar — botão fixed `bottom: 24px; right: 24px` |
| Toggle no `sidebar-footer` no dashboard | Páginas com sidebar — discreto, ao lado do email do usuário |
| Accent `#6366F1` inalterado | Roxo funciona bem em ambos os temas |

---

## Paleta de Cores

### Dark (atual — `:root`)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0F172A` | Fundo principal |
| `--surface` | `#1E293B` | Cards, sidebar |
| `--border` | `#334155` | Bordas |
| `--text` | `#F8FAFC` | Texto principal |
| `--muted` | `#94A3B8` | Texto secundário |
| `--code-bg` | `#0D1117` | Blocos de código |

### Light (`[data-theme="light"]`)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#F8FAFC` | Fundo principal |
| `--surface` | `#FFFFFF` | Cards, sidebar |
| `--border` | `#CBD5E1` | Bordas |
| `--text` | `#0F172A` | Texto principal |
| `--muted` | `#64748B` | Texto secundário |
| `--code-bg` | `#F1F5F9` | Blocos de código |

**Tokens inalterados em ambos os temas:** `--accent`, `--accent-h`, `--green`, `--red`, `--nav-active`

---

## Arquitetura

### Script de inicialização (inline no `<head>`)

Deve aparecer **depois** do `<link rel="stylesheet">` e **antes** do `</head>` em todas as páginas:

```html
<script>
  (function() {
    var saved = localStorage.getItem('da_theme');
    var sys = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', saved || sys);
  })();
</script>
```

### Função de toggle (JS inline em cada página)

```js
function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme') || 'dark';
  var next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('da_theme', next);
  updateThemeIcon();
}

function updateThemeIcon() {
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.textContent = isDark ? '☀️' : '🌙';
  btn.title = isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro';
}
```

### Botão flutuante (landing, login, signup)

HTML (antes de `</body>`):
```html
<button id="theme-toggle" class="theme-toggle-float" onclick="toggleTheme()" title="Mudar tema"></button>
```
O ícone inicial é definido pelo `updateThemeIcon()` chamado no `DOMContentLoaded` — não hardcoded no HTML.

CSS em `public/style.css`:
```css
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

### Toggle na sidebar do dashboard

HTML — adicionar após `<div class="sidebar-footer" id="user-email">`:
```html
<button id="theme-toggle" class="theme-toggle-sidebar" onclick="toggleTheme()" title="Mudar tema"></button>
```
O ícone é definido pelo `updateThemeIcon()` no `DOMContentLoaded`.

CSS em `public/dashboard/style.css`:
```css
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

### Ícone inicial

O ícone é definido pelo script de init — `updateThemeIcon()` deve ser chamado no `DOMContentLoaded` ou ao final do `<body>`:

```js
document.addEventListener('DOMContentLoaded', updateThemeIcon);
```

---

## Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `public/style.css` | + `[data-theme="light"]` tokens + `.theme-toggle-float` styles |
| `public/dashboard/style.css` | + `[data-theme="light"]` tokens + `.theme-toggle-sidebar` styles |
| `public/index.html` | + script init no `<head>` + botão flutuante + JS toggle |
| `public/dashboard/index.html` | + script init + toggle na sidebar |
| `public/dashboard/historico.html` | + script init + toggle na sidebar |
| `public/dashboard/alertas.html` | + script init + toggle na sidebar |
| `public/dashboard/configuracoes.html` | + script init + toggle na sidebar |
| `public/dashboard/login.html` | + script init + botão flutuante + JS toggle |
| `public/dashboard/signup.html` | + script init + botão flutuante + JS toggle |

---

## Tratamento de Erros

| Situação | Comportamento |
|---|---|
| `localStorage` indisponível (modo privado) | `try/catch` silencioso — usa `prefers-color-scheme` |
| `matchMedia` não suportado (browser antigo) | Fallback para dark mode |
| `data-theme` ausente | JS trata como `'dark'` por padrão |

---

## Fora do Escopo

- Animação de transição entre temas (pode ser adicionada com `transition: background 0.3s` no `body` depois)
- Sincronização entre abas (não necessário para MVP)
- Tema por página (mesmo tema em todo o site)
- `pricing.html` — não tem sidebar nem está listado nas páginas principais do dashboard; será tratado como página standalone com botão flutuante se necessário
