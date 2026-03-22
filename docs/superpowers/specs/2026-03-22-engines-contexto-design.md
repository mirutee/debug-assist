# Engine de Diagnóstico com Contexto Real — Design

**Data:** 2026-03-22
**Status:** Aprovado

## Problema

As engines atuais (`frontend.js`, `backend.js`, `sql.js`) respondem ao campo `tipo` com texto fixo, ignorando completamente o conteúdo real do payload. Se o usuário envia uma stack trace com `Date.now()`, uma query SQL com `DELETE` sem `WHERE`, ou headers de requisição sem `Content-Type`, a resposta é idêntica à de um payload vazio. Isso contradiz a proposta central do produto: ser um "raio-X de APIs" que entrega diagnóstico específico, não genérico.

## Solução

Análise de conteúdo por **pattern matching determinístico** — os engines passam a ler e interpretar os campos ricos do payload (`mensagem`, `dados.stack`, `dados.query`, `dados.html_server`, `dados.html_client`, `dados.headers`, `dados.resposta`) e produzem diagnósticos baseados no conteúdo real. Zero custo, zero dependência externa.

## Arquitetura

```
POST /v1/diagnosticos
        │
        ▼
  src/engines/index.js
  → roteia por tipo
        │
        ▼
  engine específico (frontend / backend / sql)
  → analisa campos ricos: mensagem, dados.stack, dados.query, etc.
  → retorna diagnóstico específico baseado no conteúdo real
```

Nenhuma nova dependência. Nenhuma chamada de API. Os arquivos de heurística são evoluídos in-place.

## Campos de entrada analisados por engine

### frontend.js

| Tipo | Campos analisados | O que detecta |
|------|------------------|---------------|
| `hydration_error` | `mensagem`, `dados.stack`, `dados.html_server`, `dados.html_client` | `Date.now()`, `Math.random()`, `window.`, `localStorage`, `document.`, `useLayoutEffect`, conteúdo dinâmico, diff de HTML |
| `request_error` | `status`, `dados.headers`, `dados.url`, `mensagem` | header `Authorization` ausente, `Content-Type` incorreto, CORS, URL com typo |
| `silent_error` | `mensagem`, `dados.stack` | TypeError, ReferenceError, SyntaxError, Promise rejeitada sem catch |
| `performance_issue` | `dados.tempo_execucao`, `mensagem`, `dados.stack` | long task, re-render excessivo, operação bloqueante |
| `responsive_error` | `dados.problema`, `dados.largura`, `mensagem` | overflow, elemento fixo em px, z-index conflict |

### backend.js

| Tipo | Campos analisados | O que detecta |
|------|------------------|---------------|
| `silent_backend_error` | `mensagem`, `dados.stack` | TypeError, Cannot read properties of null/undefined, Promise não tratada, catch vazio |
| `contract_error` | `mensagem`, `dados.resposta`, `dados.headers` | resposta HTML quando esperado JSON, status 200 com erro no body, campo obrigatório ausente |
| `external_api_error` | `mensagem`, `dados.status_externo` | timeout, ECONNREFUSED, 429 rate limit, 503 serviço indisponível |

### sql.js

| Campos analisados | O que detecta |
|------------------|---------------|
| `dados.query` | `DELETE`/`UPDATE` sem `WHERE`, `LIKE '%valor'` (wildcard à esquerda), subquery em loop, `ORDER BY` sem `LIMIT`, função em coluna indexada |
| `dados.tempo_execucao` | query lenta (>500ms) |
| `dados.quantidade_execucoes` | N+1 (≥10 execuções) |

## Hierarquia de especificidade

Para cada tipo, o engine tenta os padrões do mais específico para o mais genérico:

```
1. Padrão específico encontrado no conteúdo  →  diagnóstico preciso + confianca alta
2. Campos ricos presentes mas sem padrão conhecido  →  diagnóstico parcial + confianca média
3. Apenas tipo/status disponível  →  diagnóstico base atual  →  confianca padrão
```

Isso garante retrocompatibilidade total: payloads simples continuam funcionando exatamente como antes.

## Mudanças nos arquivos

| Arquivo | Ação |
|---------|------|
| `src/engines/frontend.js` | Evoluir — adicionar análise de conteúdo por pattern matching |
| `src/engines/backend.js` | Evoluir — adicionar análise de mensagem e stack |
| `src/engines/sql.js` | Evoluir — adicionar novos padrões SQL |
| `src/engines/index.js` | Sem alteração estrutural |
| `tests/engines/frontend.test.js` | Criar — testes com payloads ricos |
| `tests/engines/backend.test.js` | Criar — testes com payloads ricos |
| `tests/engines/sql.test.js` | Criar — testes com payloads ricos |

## Testes

Os testes verificam que cada engine retorna diagnóstico específico quando recebe conteúdo real:

- **frontend**: stack com `Date.now()` → causa aponta para dado dinâmico no SSR
- **frontend**: headers sem `Authorization` + status 401 → causa aponta para header ausente
- **frontend**: `mensagem` com `TypeError: Cannot read` → diagnóstico específico de TypeError
- **backend**: `mensagem` com `Cannot read properties of null` → identifica acesso a propriedade nula
- **backend**: `dados.resposta` com HTML + status 500 → detecta resposta HTML inesperada
- **sql**: query `DELETE FROM users` sem `WHERE` → nível alto, causa específica
- **sql**: query com `LIKE '%texto'` → detecta wildcard à esquerda
- **sql**: query com `ORDER BY created_at` sem `LIMIT` → detecta ordenação sem limite

Todos os testes existentes continuam passando — não há breaking change.

## Não está no escopo

- LLM / Claude API (sem custo)
- Re-execução de requisições via Axios
- Novo endpoint ou mudança de contrato
- Dashboard ou histórico
