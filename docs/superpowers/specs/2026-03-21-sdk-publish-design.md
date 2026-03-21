# DevInsight SDK — Design de Publicação no npm

**Data:** 2026-03-21
**Fase:** SDK publish — client JavaScript para integração com a DevInsight API
**Status:** Aprovado

---

## Contexto

A API está em produção em `https://devinsight-api.onrender.com`. Esta fase reescreve e publica o SDK JavaScript oficial no npm (`devinsight-sdk`), permitindo que desenvolvedores integrem diagnósticos em suas aplicações com uma única chamada.

Um SDK v0.1.0 existe em `sdk/` (commit 8fa2d0d) com a interface funcional `reportError(data, apiKey)` e URL de produção errada. Esta fase **substitui completamente** os arquivos `sdk/index.js` e `sdk/package.json` pela nova implementação class-based, e reescreve `tests/sdk/sdk.test.js`.

---

## Decisões de Design

| Decisão | Motivo |
|---|---|
| API class-based (`new DevInsight({ apiKey })`) | Melhor DX — apiKey configurada uma vez, não passada em cada chamada |
| `baseUrl` opcional no construtor | Permite testar localmente sem alterar código de produção |
| JavaScript puro + JSDoc | Sem build step, funciona direto no Node.js 18+ e browsers modernos |
| `fetch` nativo | Zero dependências, disponível em Node.js 18+ e todos os browsers modernos |
| Versão `1.0.0` | Breaking change em relação à v0.1.0 (mudança de interface funcional para class-based) |
| `sdk/` dentro do mesmo repositório | Simples para MVP, sem necessidade de repo separado |
| `files: ["index.js"]` no package.json | Publica apenas o essencial, sem testes ou docs no pacote npm |

**Breaking change em relação à v0.1.0:** O campo `status` aceito pelo SDK antigo é descartado. O construtor e a assinatura de `report()` são incompatíveis com `reportError()`. Isso é intencional — a v0.1.0 nunca foi publicada no npm.

---

## Interface Pública

```js
const DevInsight = require('devinsight-sdk');

// Inicialização (uma vez na aplicação)
const client = new DevInsight({
  apiKey: 'sua-api-key',            // obrigatório
  baseUrl: 'http://localhost:3000'  // opcional — default: https://devinsight-api.onrender.com
});

// Enviar diagnóstico
const diagnosis = await client.report({
  tipo: 'backend',             // obrigatório: 'frontend' | 'backend' | 'sql'
  mensagem: 'TypeError: ...',  // obrigatório se 'dados' ausente
  contexto: { url: '/api' },   // opcional
  dados: {}                    // obrigatório se 'mensagem' ausente
});

// diagnosis = { problema, causa, nivel, categoria, sugestoes, confianca }
```

**Contrato de validação da API (middleware `validate.js`):**
- `tipo` — sempre obrigatório
- `mensagem` OU `dados` — pelo menos um deve estar presente (regra do servidor, retorna HTTP 400 se ambos ausentes)

---

## Tratamento de Erros

| Situação | Comportamento |
|---|---|
| `apiKey` ausente no construtor | `throw new Error("DevInsight: apiKey é obrigatória")` (síncrono) |
| `tipo` ausente em `report()` | `throw new Error("DevInsight: campo 'tipo' é obrigatório")` (síncrono) |
| API retorna erro HTTP | `throw new Error("DevInsight API error <status>: <mensagem>")` (assíncrono) |
| Corpo do erro não é JSON válido | Fallback para `'desconhecido'`: `"DevInsight API error <status>: desconhecido"` |
| Erro de rede | Deixa propagar naturalmente sem swallow |

---

## Estrutura de Arquivos

```
sdk/
  index.js       — (reescrever) classe DevInsight, método report(), validações, fetch
  package.json   — (reescrever) metadata npm completo

tests/
  sdk/
    sdk.test.js  — (reescrever) 6 casos de teste com fetch mockado
```

---

## sdk/index.js

```js
// sdk/index.js
const DEFAULT_BASE_URL = 'https://devinsight-api.onrender.com';

class DevInsight {
  constructor({ apiKey, baseUrl } = {}) {
    if (!apiKey) throw new Error('DevInsight: apiKey é obrigatória');
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || DEFAULT_BASE_URL;
  }

  async report({ tipo, mensagem, contexto, dados } = {}) {
    if (!tipo) throw new Error("DevInsight: campo 'tipo' é obrigatório");

    const response = await fetch(`${this.baseUrl}/v1/diagnosticos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ tipo, mensagem, contexto, dados }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`DevInsight API error ${response.status}: ${err.erro || 'desconhecido'}`);
    }

    return response.json();
  }
}

module.exports = DevInsight;
```

---

## sdk/package.json

```json
{
  "name": "devinsight-sdk",
  "version": "1.0.0",
  "description": "SDK oficial da DevInsight API — diagnósticos inteligentes para aplicações",
  "main": "index.js",
  "files": ["index.js"],
  "keywords": ["diagnostics", "debug", "api", "devinsight", "monitoring"],
  "author": "DevInsight",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/mirutee/devinsight-api"
  },
  "homepage": "https://github.com/mirutee/devinsight-api",
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## Testes — tests/sdk/sdk.test.js

6 casos a cobrir (reescrita completa do arquivo):

1. Construtor lança erro síncrono quando `apiKey` ausente
2. `report()` lança erro síncrono quando `tipo` ausente
3. `report()` chama fetch com URL correta, método POST, header Authorization e body JSON
4. `report()` retorna o objeto de diagnóstico completo em caso de sucesso
5. `report()` lança erro com status e mensagem quando API retorna HTTP não-OK (ex: 401)
6. `baseUrl` customizada no construtor é usada na chamada fetch

Todos os testes usam `jest.fn()` para mockar `global.fetch` — sem chamadas HTTP reais.

---

## Publicação no npm

```bash
# Dentro da pasta sdk/ — NÃO rodar da raiz do projeto
cd sdk
npm login          # requer conta em npmjs.com
npm publish        # publica devinsight-sdk@1.0.0
```

**Importante:** `npm publish` deve ser executado de dentro de `sdk/`, não da raiz do repositório. O campo `files` no `package.json` garante que apenas `index.js` é publicado.

Após publicação:
```bash
npm install devinsight-sdk
```

---

## Fora do Escopo

- TypeScript types / `.d.ts`
- Publicação automática via GitHub Actions
- Versioning automatizado (semantic-release)
- Suporte a CommonJS + ESM dual package
- SDK para outras linguagens (Python, PHP, etc.)
