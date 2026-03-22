# Landing Page — Design

**Data:** 2026-03-22
**Status:** Aprovado

## Problema

O DevInsight não tem uma página pública em `/`. Quem acessa a raiz do domínio encontra vazio. Sem uma landing page, o produto não se apresenta, não converte visitantes em usuários e não comunica o posicionamento correto do serviço.

## Produto (posicionamento correto)

O DevInsight **não é** um debugger pontual. É uma API de diagnóstico que o desenvolvedor integra no projeto via SDK e usa continuamente durante o desenvolvimento e em produção. O serviço analisa erros de frontend, backend e SQL em tempo real, retornando causa, nível de severidade e sugestões de correção.

A diferença é importante para o copy: a mensagem é "integre uma vez, debug enquanto desenvolve" — não "mande um erro e veja o que acontece".

## Solução

Página estática em `public/index.html`, servida pelo Express na raiz `/` via `express.static`. Mesmo padrão já utilizado pelo dashboard. Sem build step, sem framework frontend, sem dependência nova.

## Arquitetura

```
GET /
  → Express serve public/index.html via express.static('public')

GET /dashboard/
  → Express serve public/dashboard/index.html (já existente)
```

O `express.static('public')` já está configurado para o dashboard em `/dashboard`. Ajustar para servir também a raiz, ou adicionar uma segunda rota estática para `/`.

## Estrutura da página

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

### 5. Pricing — 3 cards
| Plano | Req/mês | Preço | Destaque |
|-------|---------|-------|----------|
| Grátis | 100 | R$0 | — |
| Pro | 1.000 | R$29/mês | ✓ (borda roxa) |
| Scale | 10.000 | R$99/mês | — |

CTA de cada card: "Criar conta" → `/dashboard/signup.html`

### 6. Footer
`© 2026 DevInsight · Docs · Dashboard · contato@devinsight.com`

## Identidade visual

Segue o mesmo tema do dashboard:
- Fundo: `#0d0d0d`
- Cards/sidebar: `#111`
- Bordas: `#222`
- Accent: `#6366f1` (indigo)
- Texto primário: `#fff`
- Texto secundário: `#555` / `#888`
- Fonte: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

## Arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `public/index.html` | Criar | Landing page completa com CSS inline |
| `src/app.js` | Verificar | Confirmar que `express.static('public')` serve a raiz |
| `tests/routes/landing.test.js` | Criar | Verifica que `GET /` retorna 200 com HTML |

## Testes

- `GET /` → status 200, content-type `text/html`
- Página contém "DevInsight" no título
- Página contém link para `/docs`
- Página contém link para `/dashboard/signup.html`

## Não está no escopo

- `/dashboard/signup.html` — próximo passo separado
- Animações ou interatividade JavaScript além de smooth scroll
- Versão mobile responsiva detalhada (layout responsivo básico sim, breakpoint específico não)
- Analytics ou tracking
