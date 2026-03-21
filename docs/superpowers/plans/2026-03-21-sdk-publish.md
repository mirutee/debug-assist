# SDK Publish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever o SDK JavaScript (`sdk/`) com interface class-based e publicar no npm como `devinsight-sdk@1.0.0`.

**Architecture:** O SDK é um wrapper zero-dependências para `POST /v1/diagnosticos`. A classe `DevInsight` encapsula a apiKey e a baseUrl, expondo um único método `report()`. Os arquivos antigos (`sdk/index.js`, `sdk/package.json`, `tests/sdk/sdk.test.js`) são completamente substituídos.

**Tech Stack:** JavaScript (Node.js 18+), Jest (testes), fetch nativo, npm

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `sdk/index.js` | Reescrever | Classe `DevInsight` com método `report()` |
| `sdk/package.json` | Reescrever | Metadata npm completo para publicação |
| `tests/sdk/sdk.test.js` | Reescrever | 6 casos de teste com fetch mockado |

---

### Task 1: Reescrever SDK com TDD

**Files:**
- Rewrite: `sdk/index.js`
- Rewrite: `sdk/package.json`
- Rewrite: `tests/sdk/sdk.test.js`

- [ ] **Step 1: Reescrever tests/sdk/sdk.test.js com os 6 casos**

Substituir completamente o conteúdo de `tests/sdk/sdk.test.js`:

```js
// tests/sdk/sdk.test.js
const DevInsight = require('../../sdk/index');

describe('DevInsight SDK', () => {
  afterEach(() => {
    delete global.fetch;
  });

  it('lança erro síncrono quando apiKey ausente', () => {
    expect(() => new DevInsight({})).toThrow('DevInsight: apiKey é obrigatória');
  });

  it('lança erro síncrono quando tipo ausente em report()', async () => {
    const client = new DevInsight({ apiKey: 'test-key' });
    await expect(client.report({})).rejects.toThrow("DevInsight: campo 'tipo' é obrigatório");
  });

  it('chama fetch com URL, método, header e body corretos', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ problema: 'ok', causa: 'x', nivel: 'baixo', sugestoes: [], confianca: 0.9 }),
    });
    const client = new DevInsight({ apiKey: 'minha-key' });
    await client.report({ tipo: 'backend', mensagem: 'erro' });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://devinsight-api.onrender.com/v1/diagnosticos',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer minha-key',
        }),
        body: JSON.stringify({ tipo: 'backend', mensagem: 'erro', contexto: undefined, dados: undefined }),
      })
    );
  });

  it('retorna o objeto de diagnóstico completo em caso de sucesso', async () => {
    const mockDiagnosis = {
      problema: 'N+1 query detectada',
      causa: 'Loop sem eager loading',
      nivel: 'alto',
      categoria: 'sql',
      sugestoes: ['Use include/join'],
      confianca: 0.95,
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockDiagnosis,
    });
    const client = new DevInsight({ apiKey: 'test-key' });
    const result = await client.report({ tipo: 'sql', mensagem: 'query lenta' });

    expect(result).toEqual(mockDiagnosis);
  });

  it('lança erro com status e mensagem quando API retorna HTTP não-OK', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ erro: 'API Key inválida' }),
    });
    const client = new DevInsight({ apiKey: 'key-invalida' });
    await expect(client.report({ tipo: 'backend', mensagem: 'teste' }))
      .rejects.toThrow('DevInsight API error 401: API Key inválida');
  });

  it('usa baseUrl customizada fornecida no construtor', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ problema: 'ok' }),
    });
    const client = new DevInsight({ apiKey: 'test-key', baseUrl: 'http://localhost:3000' });
    await client.report({ tipo: 'frontend', mensagem: 'hydration error' });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/diagnosticos',
      expect.anything()
    );
  });
});
```

- [ ] **Step 2: Rodar os testes para confirmar que falham (TDD)**

```bash
npx jest tests/sdk/sdk.test.js --no-coverage
```

Saída esperada: falha na importação ou nos testes (o `sdk/index.js` atual ainda tem a interface antiga com `reportError`).

- [ ] **Step 3: Reescrever sdk/index.js**

Substituir completamente o conteúdo de `sdk/index.js`:

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

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
npx jest tests/sdk/sdk.test.js --no-coverage
```

Saída esperada:
```
PASS tests/sdk/sdk.test.js
  DevInsight SDK
    ✓ lança erro síncrono quando apiKey ausente
    ✓ lança erro síncrono quando tipo ausente em report()
    ✓ chama fetch com URL, método, header e body corretos
    ✓ retorna o objeto de diagnóstico completo em caso de sucesso
    ✓ lança erro com status e mensagem quando API retorna HTTP não-OK
    ✓ usa baseUrl customizada fornecida no construtor

Tests: 6 passed, 6 total
```

- [ ] **Step 5: Rodar toda a suite para confirmar sem regressões**

```bash
npx jest --no-coverage
```

Saída esperada: todos os testes passando (era 63 antes, agora serão 63 + diferença pelos testes do SDK reescritos).

- [ ] **Step 6: Reescrever sdk/package.json**

Substituir completamente o conteúdo de `sdk/package.json`:

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

- [ ] **Step 7: Commit**

```bash
git add sdk/index.js sdk/package.json tests/sdk/sdk.test.js
git commit -m "feat: reescrever SDK para devinsight-sdk v1.0.0 (class-based, zero deps)"
```

---

### Task 2: Publicar no npm (requer ação humana)

Esta task não pode ser automatizada — requer conta npm e autenticação interativa.

**Files:** nenhum (publicação do que está em `sdk/`)

- [ ] **Step 1: Criar conta no npmjs.com (se não tiver)**

Acessar https://www.npmjs.com/signup

- [ ] **Step 2: Fazer login no npm dentro da pasta sdk/**

```bash
cd sdk
npm login
```

Preencher: username, password, email, OTP (se 2FA ativado).

- [ ] **Step 3: Confirmar que o pacote está pronto**

```bash
npm pack --dry-run
```

Saída esperada: apenas `index.js` listado (graças ao campo `files`).

- [ ] **Step 4: Publicar**

```bash
npm publish
```

Saída esperada:
```
npm notice Publishing to https://registry.npmjs.org/ with tag latest
+ devinsight-sdk@1.0.0
```

- [ ] **Step 5: Confirmar publicação**

```bash
npm show devinsight-sdk
```

Saída esperada: metadata do pacote com versão `1.0.0`.

- [ ] **Step 6: Testar instalação do pacote publicado**

```bash
cd /tmp
mkdir test-sdk && cd test-sdk
npm init -y
npm install devinsight-sdk
node -e "const DevInsight = require('devinsight-sdk'); console.log(typeof DevInsight);"
```

Saída esperada: `function`

- [ ] **Step 7: Voltar para a raiz e commitar referência**

```bash
cd C:/PROJETOS/API
```

Adicionar ao final de `.env.example`:
```
# SDK
# npm install devinsight-sdk
```

```bash
git add .env.example
git commit -m "docs: adicionar referência ao SDK publicado no npm"
git push origin master
```
