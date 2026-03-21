# DevInsight Dashboard — Design

**Data:** 2026-03-21
**Fase:** Dashboard — interface web para o usuário ver seu plano, uso e API Key
**Status:** Aprovado

---

## Contexto

A API está em produção em `https://devinsight-api.onrender.com`. Esta fase adiciona um dashboard web acessível em `/dashboard`, servido pelo próprio Express como arquivos estáticos — sem segundo deploy, sem build step, sem framework frontend.

---

## Decisões de Design

| Decisão | Motivo |
|---|---|
| Vanilla HTML/CSS/JS em `public/dashboard/` | Zero dependências frontend, zero build step, servido pelo Express existente |
| Supabase JS via CDN | Login com Supabase Auth sem instalação — `<script>` tag direto no HTML |
| JWT armazenado em `localStorage` | Padrão simples para MVP de dashboard interno |
| Layout sidebar escuro | Escolha do usuário — estilo SaaS moderno |
| Sem histórico de diagnósticos | Requer `usuario_id` na tabela `diagnosticos` — fora do escopo desta fase |

---

## Páginas

| Rota | Arquivo | Função |
|---|---|---|
| `/dashboard/login` | `public/dashboard/login.html` | Formulário de login (email + senha) |
| `/dashboard` ou `/dashboard/` | `public/dashboard/index.html` | Tela principal com stats, plano e API Key |

---

## Fluxo de Autenticação

```
1. Usuário acessa /dashboard
   └─ Verifica localStorage.getItem('devinsight_token')
      ├─ Ausente → redireciona para /dashboard/login
      └─ Presente → chama GET /v1/auth/me

2. Login (/dashboard/login)
   └─ POST /v1/auth/login { email, senha }
      ├─ Erro → exibe mensagem de erro inline
      └─ Sucesso → salva token em localStorage → redireciona para /dashboard

3. Dashboard (/dashboard)
   └─ GET /v1/auth/me  Authorization: Bearer <token>
      ├─ 401 → limpa localStorage → redireciona para /dashboard/login
      └─ 200 → renderiza: email, plano, uso_mensal, limite_mensal, api_key
```

---

## Design Visual

### Login (`public/dashboard/login.html`)

- Fundo escuro `#0d0d0d`
- Card centralizado com logo DevInsight
- Campos: Email, Senha
- Botão "Entrar" (roxo `#6366f1`)
- Mensagem de erro inline (vermelho) abaixo do botão
- Link: "Não tem conta? Cadastre-se" → link para docs ou página futura

### Dashboard (`public/dashboard/index.html`)

Layout com sidebar fixa à esquerda + área de conteúdo:

**Sidebar:**
- Logo DevInsight no topo
- Link ativo: "Visão Geral" (ícone 🏠)
- Links inativos: "Docs" (abre nova aba), "Sair"
- Email do usuário no rodapé da sidebar

**Conteúdo principal:**
- Título "Visão Geral" + email do usuário
- Grid 2 colunas:
  - Card "Uso este mês": número `uso_mensal / limite_mensal`, barra de progresso, dias até reset
  - Card "Plano atual": nome do plano, limite, botão "Fazer upgrade →" (link para e-mail/WhatsApp de contato por ora)
- Card "Sua API Key":
  - Campo mascarado (`••••••••-••••-...`)
  - Botão "👁 Revelar" (toggle mostra/esconde)
  - Botão "📋 Copiar" (copia para clipboard, feedback visual "Copiado!")
- Botão "Sair" limpa localStorage e redireciona para `/dashboard/login`

---

## Mudanças no Backend

### `src/app.js`

Adicionar static serving **antes** das rotas da API:

```js
const path = require("path");
app.use("/dashboard", express.static(path.join(__dirname, "../public/dashboard")));
```

### `public/dashboard/` (criar)

```
public/
  dashboard/
    index.html   — tela principal
    login.html   — tela de login
    style.css    — estilos compartilhados (dark theme, sidebar, cards)
```

---

## Autenticação no Frontend

O login usa `fetch` direto para `POST /v1/auth/login` — **zero dependência CDN**. O Supabase JS não é necessário pois a API já abstrai a autenticação.

---

## GET /v1/auth/me — Resposta esperada

```json
{
  "email": "user@exemplo.com",
  "plano": "free",
  "uso_mensal": 42,
  "limite_mensal": 100,
  "api_key": "uuid-da-api-key"
}
```

**Nota:** `plano` é o campo `plano_id` da tabela `usuarios`, que armazena texto legível (`"free"`, `"pro"`, `"scale"`, `"enterprise"`). Não é um ID numérico — pode ser exibido diretamente no dashboard.

Essa rota já existe e funciona em produção.

---

## Integração com Express

```js
// src/app.js — adicionar antes das rotas da API
const path = require("path");
app.use("/dashboard", express.static(path.join(__dirname, "../public/dashboard")));
```

`__dirname` é `src/`, então `../public/dashboard` resolve para `public/dashboard/` na raiz do projeto. Express serve `index.html` automaticamente para `/dashboard/`. Ao acessar `/dashboard` (sem barra), o Express redireciona para `/dashboard/` — comportamento padrão do `express.static`.

---

## Tratamento de Erros

| Situação | Comportamento |
|---|---|
| Login com credenciais erradas | Mensagem inline: "Email ou senha incorretos" |
| Email não confirmado | Mensagem inline: "Confirme seu email antes de fazer login" |
| Token expirado/inválido em /dashboard (401) | `console.error` do erro, limpa localStorage, redireciona para login |
| Usuário autenticado mas sem registro em `usuarios` (404) | Mensagem: "Conta não configurada. Entre em contato com o suporte." |
| Erro de rede | Mensagem inline: "Erro de conexão. Tente novamente." |

**Nota de segurança:** JWT em `localStorage` é aceitável para este MVP. Se a superfície de XSS se tornar uma preocupação futura, migrar para cookies `HttpOnly`.

**Nota sobre rate limiting:** `POST /v1/auth/login` não passa pelo rate limiter global de 60 req/min (que está scoped apenas para `/v1/diagnosticos`). Para MVP isso é aceitável — adicionar rate limit específico no login fica para versão futura.

---

## Dias até o Reset

O reset acontece às 00:00 UTC do dia 1° de cada mês (via pg_cron). Calcular no frontend:

```js
const hoje = new Date();
const primeiroDoPróximoMês = new Date(Date.UTC(
  hoje.getUTCMonth() === 11 ? hoje.getUTCFullYear() + 1 : hoje.getUTCFullYear(),
  hoje.getUTCMonth() === 11 ? 0 : hoje.getUTCMonth() + 1,
  1
));
const diasRestantes = Math.ceil((primeiroDoPróximoMês - hoje) / (1000 * 60 * 60 * 24));
```

---

## Fora do Escopo

- Histórico de diagnósticos (requer `usuario_id` na tabela `diagnosticos`)
- Página de cadastro no dashboard (existe via `POST /v1/auth/signup`)
- Gerenciamento de plano / pagamentos
- Regeneração de API Key
- Troca de senha
