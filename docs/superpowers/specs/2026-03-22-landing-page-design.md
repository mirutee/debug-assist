# Landing Page — Design

**Data:** 2026-03-22
**Status:** Aprovado

## Problema

O DevInsight não tem uma página pública em `/`. Quem acessa a raiz do domínio encontra vazio. Sem uma landing page, o produto não se apresenta, não converte visitantes em usuários e não comunica o posicionamento correto do serviço.

## Produto (posicionamento correto)

O DevInsight **não é** um debugger pontual. É uma API de diagnóstico que o desenvolvedor integra no projeto via SDK e usa continuamente durante o desenvolvimento e em produção. O serviço analisa erros de frontend, backend e SQL em tempo real, retornando causa, nível de severidade e sugestões de correção.

A diferença é importante para o copy: a mensagem é "integre uma vez, debug enquanto desenvolve" — não "mande um erro e veja o que acontece".

## Solução

Página estática em `public/index.html`, servida pelo Express na raiz `/`. Sem build step, sem framework frontend, sem dependência nova.

## Arquitetura

O `src/app.js` atual monta o dashboard assim:

```js
app.use("/dashboard", express.static(path.join(__dirname, "../public/dashboard")));
```

Para servir a landing page em `/`, adicionar **antes das rotas de API** (após `app.use(express.json())`):

```js
app.use(express.static(path.join(__dirname, "../public")));
```

Isso serve `public/index.html` em `GET /` e mantém `public/dashboard/` acessível em `/dashboard/` como antes. A rota `/dashboard` com `express.static` explícita pode ser removida pois `express.static('public')` já cobre o subdiretório, mas por segurança mantê-las as duas não causa conflito.

**Ordem de middleware importante:** `express.static` deve ser adicionado **antes** das rotas de API (`/v1/diagnosticos`, `/v1/auth`) para que requisições a arquivos estáticos não passem pelos middlewares de auth e rate limit. Rotas de API ainda funcionam normalmente pois o static middleware só intercepta caminhos que correspondem a arquivos existentes em `public/`.

## Estrutura da página

### `<title>`
```html
<title>DevInsight — API de diagnóstico para desenvolvedores</title>
```

### 1. Navbar
- Logo: ponto roxo (`#6366f1`) + texto "DevInsight"
- Links: Docs → `/docs` | Preços → `#pricing`
- CTA: botão "Criar conta" → `/dashboard/signup.html`

### 2. Hero
- Label (uppercase, cinza): `API DE DIAGNÓSTICO PARA DESENVOLVEDORES`
- Headline (grande, branco): `Integre uma vez. Debug enquanto desenvolve.`
- Subtítulo (cinza): `Uma API que analisa seus erros de frontend, backend e SQL em tempo real — com causa, nível e sugestões de correção.`
- CTA primário (roxo): `Criar conta grátis` → `/dashboard/signup.html`
- CTA secundário (outline): `Ver documentação →` → `/docs`

### 3. Features — 3 cards
| Ícone | Título | Descrição |
|-------|--------|-----------|
| ⚡ | Frontend | Hidratação, CORS, TypeError, erros silenciosos |
| 🔧 | Backend | Null access, HTML inesperado, ECONNREFUSED, rate limit |
| 🗄️ | SQL | DELETE sem WHERE, N+1, LIKE wildcard, queries lentas |

### 4. Como funciona — 3 passos
1. Integre o SDK no seu projeto
2. Envie os erros para `POST /v1/diagnosticos`
3. Receba causa, nível e sugestões de correção

### 5. Pricing — 3 cards (id="pricing")
| Plano | Req/mês | Preço | Destaque |
|-------|---------|-------|----------|
| Grátis | 100 | R$0 | — |
| Pro | 1.000 | R$29/mês | ✓ (borda roxa) |
| Scale | 10.000 | R$99/mês | — |

CTA de cada card: `Criar conta` → `/dashboard/signup.html`

**Nota:** `/dashboard/signup.html` ainda não existe (próximo passo). Os links apontam para esse destino final — quando o signup for implementado, os links já estarão corretos.

### 6. Footer
`© 2026 DevInsight · Docs · Dashboard · contato@devinsight.com`

## Identidade visual

Segue o mesmo tema do dashboard:
- Fundo: `#0d0d0d`
- Cards: `#111`
- Bordas: `#222`
- Accent: `#6366f1` (indigo)
- Texto primário: `#fff`
- Texto secundário: `#555` / `#888`
- Fonte: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

**CSS:** bloco `<style>` dentro do próprio `public/index.html`. Não usa arquivo CSS separado.

## Arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `public/index.html` | Criar | Landing page completa com CSS em bloco `<style>` |
| `src/app.js` | Modificar | Adicionar `express.static(path.join(__dirname, "../public"))` antes das rotas de API |
| `tests/routes/landing.test.js` | Criar | Verifica que `GET /` retorna 200 com HTML (mesmo padrão de `tests/routes/dashboard.test.js`) |

## Testes

- `GET /` → status 200, content-type `text/html`
- Body contém `DevInsight` (presente no `<title>` e no conteúdo da página)
- Body contém `/docs`
- Body contém `/dashboard/signup.html`
- Rotas de API existentes (`GET /health`, `POST /v1/diagnosticos`) continuam funcionando após a mudança no `app.js`

## Não está no escopo

- `/dashboard/signup.html` — próximo passo separado
- Animações ou interatividade JavaScript além de smooth scroll para `#pricing`
- Versão mobile responsiva detalhada (layout responsivo básico sim)
- Analytics ou tracking
