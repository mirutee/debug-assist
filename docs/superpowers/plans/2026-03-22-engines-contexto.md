# Engine de Diagnóstico com Contexto Real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evoluir as três engines de diagnóstico para analisar o conteúdo real dos payloads (mensagem de erro, stack trace, query SQL, HTML, headers) via pattern matching determinístico, produzindo diagnósticos específicos ao invés de respostas genéricas fixas.

**Architecture:** Cada engine recebe um payload com campos ricos opcionais (`mensagem`, `dados.stack`, `dados.query`, `dados.html_server/html_client`, `dados.headers`, `dados.resposta`) e tenta padrões do mais específico para o mais genérico. Se nenhum padrão rico for encontrado, o comportamento atual é preservado (retrocompatibilidade total). Nenhuma dependência externa, nenhum LLM, nenhuma mudança de contrato.

**Tech Stack:** Node.js, Jest — sem dependências novas

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `src/engines/sql.js` | Modificar | Adicionar: DELETE/UPDATE sem WHERE, LIKE com wildcard à esquerda, ORDER BY sem LIMIT |
| `src/engines/backend.js` | Modificar | Adicionar: análise de mensagem para null access / TypeError, HTML response, ECONNREFUSED, rate limit |
| `src/engines/frontend.js` | Modificar | Adicionar: análise de stack para Date.now/Math.random/window, diff HTML, CORS, TypeError/ReferenceError |
| `tests/engines/sql.test.js` | Modificar | Adicionar casos de teste para os novos padrões SQL |
| `tests/engines/backend.test.js` | Modificar | Adicionar casos de teste para análise de mensagem e resposta |
| `tests/engines/frontend.test.js` | Modificar | Adicionar casos de teste para análise de stack e contexto rico |

---

## Task 1: Novos padrões SQL

**Files:**
- Modify: `src/engines/sql.js`
- Modify: `tests/engines/sql.test.js`

- [ ] **Step 1: Adicionar os testes novos em `tests/engines/sql.test.js`**

Abrir o arquivo e adicionar ao final do `describe`, antes do `});` de fechamento:

```js
  it("detecta DELETE sem WHERE — nivel alto", () => {
    const r = diagnosticarSQL({
      tipo: "sql_analysis",
      mensagem: "",
      dados: { query: "DELETE FROM users", tempo_execucao: 5 },
    });
    expect(r.nivel).toBe("alto");
    expect(r.problema).toMatch(/WHERE/i);
  });

  it("detecta UPDATE sem WHERE — nivel alto", () => {
    const r = diagnosticarSQL({
      tipo: "sql_analysis",
      mensagem: "",
      dados: { query: "UPDATE users SET active = false", tempo_execucao: 5 },
    });
    expect(r.nivel).toBe("alto");
    expect(r.problema).toMatch(/WHERE/i);
  });

  it("detecta LIKE com wildcard à esquerda — nivel médio", () => {
    const r = diagnosticarSQL({
      tipo: "sql_analysis",
      mensagem: "",
      dados: { query: "SELECT id FROM users WHERE name LIKE '%silva'", tempo_execucao: 50 },
    });
    expect(r.sugestoes.join(" ")).toMatch(/wildcard|índice|LIKE/i);
  });

  it("detecta ORDER BY sem LIMIT em query simples", () => {
    const r = diagnosticarSQL({
      tipo: "sql_analysis",
      mensagem: "",
      dados: { query: "SELECT id, name FROM logs ORDER BY created_at DESC", tempo_execucao: 50 },
    });
    expect(r.sugestoes.join(" ")).toMatch(/LIMIT/i);
  });
```

- [ ] **Step 2: Rodar os testes novos para confirmar que falham**

```bash
npx jest tests/engines/sql.test.js --no-coverage
```

Saída esperada: 4 novos testes FAIL, os 6 existentes PASS.

- [ ] **Step 3: Implementar os novos padrões em `src/engines/sql.js`**

Adicionar **antes** do bloco `// Slow query` (após o bloco N+1, linha ~43):

```js
  // DELETE/UPDATE sem WHERE — retorno antecipado, risco de destruição de dados
  if (
    (query.startsWith("DELETE") || query.startsWith("UPDATE")) &&
    !query.includes("WHERE")
  ) {
    return {
      ...base,
      problema: "DELETE/UPDATE sem cláusula WHERE detectado",
      causa: "Query pode afetar ou apagar TODOS os registros da tabela",
      nivel: "alto",
      sugestoes: [
        "Sempre incluir WHERE em DELETE e UPDATE",
        "Testar a cláusula WHERE com SELECT antes de executar",
        "Usar transação para poder fazer rollback se necessário",
      ],
      confianca: 0.98,
    };
  }
```

Adicionar **antes** do bloco `if (problemas.length === 0)` (após os blocos de `SELECT *` e `LIMIT`):

```js
  // LIKE com wildcard à esquerda — impede uso de índice
  if (query.includes("LIKE '%" ) || query.includes('LIKE "%')) {
    if (nivel === "baixo") nivel = "médio";
    sugestoes.push("LIKE com '%' à esquerda não usa índice — considere Full Text Search");
    sugestoes.push("Se a busca for comum, avalie pg_trgm ou índice GIN no PostgreSQL");
    problemas.push("LIKE com wildcard à esquerda");
  }
```

Para o `ORDER BY sem LIMIT`, o bloco de `!query.includes("LIMIT")` já existe. Expandir a condição para incluir `ORDER BY`:

Localizar:
```js
  // No LIMIT
  if (query.includes("SELECT") && !query.includes("LIMIT")) {
    sugestoes.push("Adicionar LIMIT para evitar retorno de grandes volumes de dados");
  }
```

Substituir por:
```js
  // No LIMIT
  if (query.includes("SELECT") && !query.includes("LIMIT")) {
    if (query.includes("ORDER BY")) {
      sugestoes.push("ORDER BY sem LIMIT pode ser muito custoso — adicione LIMIT para paginar resultados");
    } else {
      sugestoes.push("Adicionar LIMIT para evitar retorno de grandes volumes de dados");
    }
  }
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
npx jest tests/engines/sql.test.js --no-coverage
```

Saída esperada: todos os 10 testes PASS.

- [ ] **Step 5: Rodar a suite completa para confirmar sem regressões**

```bash
npx jest --no-coverage
```

Saída esperada: todos os testes PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engines/sql.js tests/engines/sql.test.js
git commit -m "feat: engine sql detecta DELETE/UPDATE sem WHERE, LIKE wildcard e ORDER BY sem LIMIT"
```

---

## Task 2: Análise de contexto no engine backend

**Files:**
- Modify: `src/engines/backend.js`
- Modify: `tests/engines/backend.test.js`

- [ ] **Step 1: Adicionar os testes novos em `tests/engines/backend.test.js`**

Adicionar ao final do `describe`, antes do `});` de fechamento:

```js
  it("silent_backend_error com null access na mensagem — causa específica", () => {
    const r = diagnosticarBackend({
      tipo: "silent_backend_error",
      mensagem: "TypeError: Cannot read properties of null (reading 'id')",
      dados: {},
    });
    expect(r.causa).toMatch(/null|undefined|propriedade/i);
    expect(r.confianca).toBeGreaterThan(0.85);
  });

  it("silent_backend_error com 'is not a function' na mensagem", () => {
    const r = diagnosticarBackend({
      tipo: "silent_backend_error",
      mensagem: "TypeError: user.save is not a function",
      dados: {},
    });
    expect(r.causa).toMatch(/função|método|is not a function/i);
  });

  it("contract_error com resposta HTML inesperada", () => {
    const r = diagnosticarBackend({
      tipo: "contract_error",
      mensagem: "",
      dados: { resposta: "<!DOCTYPE html><html><body>Internal Server Error</body></html>" },
    });
    expect(r.causa).toMatch(/HTML|JSON/i);
    expect(r.sugestoes.join(" ")).toMatch(/JSON|html/i);
  });

  it("external_api_error com ECONNREFUSED na mensagem", () => {
    const r = diagnosticarBackend({
      tipo: "external_api_error",
      mensagem: "connect ECONNREFUSED 127.0.0.1:5432",
      dados: {},
    });
    expect(r.causa).toMatch(/recusou|ECONNREFUSED|indisponível/i);
  });

  it("external_api_error com rate limit (status 429)", () => {
    const r = diagnosticarBackend({
      tipo: "external_api_error",
      mensagem: "Request failed with status code 429",
      dados: { status_externo: 429 },
    });
    expect(r.causa).toMatch(/rate limit|limite|429/i);
    expect(r.sugestoes.join(" ")).toMatch(/retry|espera|backoff/i);
  });
```

- [ ] **Step 2: Rodar os testes novos para confirmar que falham**

```bash
npx jest tests/engines/backend.test.js --no-coverage
```

Saída esperada: 5 novos testes FAIL, os 4 existentes PASS.

- [ ] **Step 3: Implementar análise de contexto em `src/engines/backend.js`**

No bloco `if (tipo === "silent_backend_error")`, substituir o retorno atual pela versão com análise de mensagem:

```js
  if (tipo === "silent_backend_error") {
    const msg = mensagem.toLowerCase();
    let causa = "Exceção capturada mas não tratada adequadamente";
    let confianca = 0.85;

    if (msg.includes("cannot read propert") || msg.includes("of null") || msg.includes("of undefined")) {
      causa = "Acesso a propriedade de objeto null ou undefined — verifique se o dado existe antes de acessá-lo";
      confianca = 0.95;
    } else if (msg.includes("is not a function")) {
      causa = "Método ou função não existe no objeto — verifique o tipo do dado antes de chamar o método";
      confianca = 0.95;
    } else if (msg.includes("is not defined")) {
      causa = "Variável ou módulo não declarado — verifique imports e escopo";
      confianca = 0.92;
    }

    return {
      ...base,
      problema: "Erro silencioso no backend",
      causa,
      nivel: "alto",
      sugestoes: [
        "Nunca deixar bloco catch vazio",
        "Logar stack trace completo do erro",
        "Retornar status HTTP adequado em vez de 200 com erro no body",
        "Implementar handler global de erros no Express",
      ],
      confianca,
    };
  }
```

No bloco `if (tipo === "contract_error")`, substituir pela versão com análise de resposta:

```js
  if (tipo === "contract_error") {
    const resposta = String(dados.resposta || "");
    let causa = "Resposta não corresponde ao schema esperado";
    let confianca = 0.85;

    if (resposta.trimStart().startsWith("<")) {
      causa = "API retornou HTML em vez de JSON — provavelmente uma página de erro do servidor";
      confianca = 0.95;
    }

    return {
      ...base,
      problema: "Violação de contrato de API",
      causa,
      nivel: "alto",
      sugestoes: [
        "Validar resposta com Zod ou Joi antes de retornar ao cliente",
        "Verificar se o status HTTP corresponde ao conteúdo retornado",
        "Garantir que erros 5xx retornem JSON e não HTML",
        "Documentar e respeitar o OpenAPI spec",
      ],
      confianca,
    };
  }
```

No bloco `if (tipo === "external_api_error")`, substituir pela versão com análise de mensagem:

```js
  if (tipo === "external_api_error") {
    const msg = mensagem.toLowerCase();
    const statusExterno = dados.status_externo;
    let causa = "Serviço externo indisponível ou com comportamento inesperado";
    let confianca = 0.85;
    const sugestoes = [
      "Adicionar timeout explícito nas chamadas externas",
      "Implementar fallback ou retry com backoff exponencial",
      "Tratar erros da API externa separadamente dos erros internos",
      "Monitorar disponibilidade do serviço externo",
    ];

    if (msg.includes("econnrefused")) {
      causa = "Conexão recusada — o serviço externo não está aceitando conexões (ECONNREFUSED)";
      confianca = 0.97;
    } else if (msg.includes("etimedout") || msg.includes("timeout")) {
      causa = "Timeout na chamada externa — o serviço não respondeu no tempo esperado";
      confianca = 0.95;
    } else if (statusExterno === 429 || msg.includes("429") || msg.includes("rate limit") || msg.includes("too many")) {
      causa = "Rate limit atingido — a API externa recusou a requisição por excesso de chamadas (429)";
      confianca = 0.97;
      sugestoes.unshift("Aguardar o período de reset antes de tentar novamente");
      sugestoes.unshift("Implementar retry com espera exponencial ao receber 429");
    } else if (statusExterno === 503 || msg.includes("503")) {
      causa = "Serviço externo temporariamente indisponível (503)";
      confianca = 0.95;
    }

    return {
      ...base,
      problema: "Falha em integração com API externa",
      causa,
      nivel: "médio",
      sugestoes,
      confianca,
    };
  }
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
npx jest tests/engines/backend.test.js --no-coverage
```

Saída esperada: todos os 9 testes PASS.

- [ ] **Step 5: Rodar a suite completa para confirmar sem regressões**

```bash
npx jest --no-coverage
```

Saída esperada: todos os testes PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engines/backend.js tests/engines/backend.test.js
git commit -m "feat: engine backend analisa mensagem de erro para null access, HTML response e ECONNREFUSED"
```

---

## Task 3: Análise de contexto no engine frontend

**Files:**
- Modify: `src/engines/frontend.js`
- Modify: `tests/engines/frontend.test.js`

- [ ] **Step 1: Adicionar os testes novos em `tests/engines/frontend.test.js`**

Adicionar ao final do `describe`, antes do `});` de fechamento:

```js
  it("hydration_error com Date.now na stack — causa específica", () => {
    const r = diagnosticarFrontend({
      tipo: "hydration_error",
      mensagem: "Hydration failed because the initial UI does not match",
      dados: {
        stack: "at Component (Component.jsx:12)\n  Date.now() called during render",
      },
    });
    expect(r.causa).toMatch(/Date\.now|dado dinâmico|tempo/i);
    expect(r.confianca).toBeGreaterThan(0.85);
  });

  it("hydration_error com window na stack — acesso ao browser no SSR", () => {
    const r = diagnosticarFrontend({
      tipo: "hydration_error",
      mensagem: "Hydration failed",
      dados: {
        stack: "ReferenceError: window is not defined\n  at MyComponent",
      },
    });
    expect(r.causa).toMatch(/window|browser|SSR|servidor/i);
  });

  it("hydration_error com html_server e html_client diferentes — diff detectado", () => {
    const r = diagnosticarFrontend({
      tipo: "hydration_error",
      mensagem: "Hydration failed",
      dados: {
        html_server: "<div>Olá João</div>",
        html_client: "<div>Olá Maria</div>",
      },
    });
    expect(r.causa).toMatch(/servidor|cliente|diferente|SSR/i);
  });

  it("request_error 401 com header Authorization ausente — causa específica", () => {
    const r = diagnosticarFrontend({
      tipo: "request_error",
      status: 401,
      mensagem: "Unauthorized",
      dados: {
        headers: { "Content-Type": "application/json" },
      },
    });
    expect(r.causa).toMatch(/Authorization|header|ausente/i);
  });

  it("request_error com CORS na mensagem — causa CORS", () => {
    const r = diagnosticarFrontend({
      tipo: "request_error",
      status: 0,
      mensagem: "Access to fetch at 'https://api.exemplo.com' has been blocked by CORS policy",
      dados: {},
    });
    expect(r.causa).toMatch(/CORS/i);
    expect(r.sugestoes.join(" ")).toMatch(/origin|CORS|header/i);
  });

  it("silent_error com TypeError na mensagem — causa específica", () => {
    const r = diagnosticarFrontend({
      tipo: "silent_error",
      mensagem: "TypeError: Cannot read properties of undefined (reading 'map')",
      dados: {},
    });
    expect(r.causa).toMatch(/TypeError|undefined|null/i);
  });

  it("silent_error com ReferenceError na mensagem — causa específica", () => {
    const r = diagnosticarFrontend({
      tipo: "silent_error",
      mensagem: "ReferenceError: myVar is not defined",
      dados: {},
    });
    expect(r.causa).toMatch(/ReferenceError|declarad|definid/i);
  });
```

- [ ] **Step 2: Rodar os testes novos para confirmar que falham**

```bash
npx jest tests/engines/frontend.test.js --no-coverage
```

Saída esperada: 7 novos testes FAIL, os 7 existentes PASS.

- [ ] **Step 3: Implementar análise de contexto em `src/engines/frontend.js`**

No bloco `if (tipo === "hydration_error")`, substituir pelo código com análise de stack e HTML:

```js
  if (tipo === "hydration_error") {
    const stack = String(dados.stack || "");
    const htmlServer = dados.html_server;
    const htmlClient = dados.html_client;
    let causa = "Diferença entre renderização no servidor (SSR) e no cliente";
    let confianca = 0.85;
    const sugestoes = [
      "Evitar uso de Date.now(), Math.random() ou window no render",
      "Utilizar useEffect para dados que mudam apenas no cliente",
      "Garantir que dados do servidor e do cliente sejam consistentes",
    ];

    if (stack.includes("Date.now") || mensagem.includes("Date.now")) {
      causa = "Date.now() chamado durante o render — produz valor diferente no servidor e no cliente";
      confianca = 0.97;
    } else if (stack.includes("Math.random")) {
      causa = "Math.random() chamado durante o render — produz valor diferente em cada execução";
      confianca = 0.97;
    } else if (
      stack.includes("window.") ||
      stack.includes("localStorage") ||
      stack.includes("document.") ||
      stack.includes("window is not defined")
    ) {
      causa = "Acesso a API do browser (window/localStorage/document) durante SSR — não existe no servidor";
      confianca = 0.97;
      sugestoes.unshift("Mover acesso a window/localStorage/document para dentro de useEffect");
      sugestoes.unshift("Verificar com 'typeof window !== undefined' antes de acessar APIs do browser");
    } else if (htmlServer && htmlClient && htmlServer !== htmlClient) {
      causa = "Conteúdo HTML do servidor difere do cliente — dado dinâmico renderizado no SSR com valor inconsistente";
      confianca = 0.92;
    }

    return {
      ...base,
      problema: "Erro de hidratação",
      causa,
      nivel: "alto",
      sugestoes,
      confianca,
    };
  }
```

No bloco `if (tipo === "request_error")`, adicionar análise de CORS e headers **antes** das verificações de status existentes:

```js
  if (tipo === "request_error") {
    const msg = mensagem.toLowerCase();

    // CORS — detectado pelo conteúdo da mensagem, independe do status
    if (msg.includes("cors") || msg.includes("access-control") || msg.includes("has been blocked by cors")) {
      return {
        ...base,
        problema: "Erro de CORS",
        causa: "Requisição bloqueada pela política CORS do servidor — o origin não está autorizado",
        nivel: "alto",
        sugestoes: [
          "Adicionar o header 'Access-Control-Allow-Origin' no servidor",
          "Verificar se o endpoint aceita requisições do origin atual",
          "Em desenvolvimento, usar um proxy ou configurar CORS no backend",
        ],
        confianca: 0.97,
      };
    }

    if (status === 401) {
      // Header Authorization ausente — diagnóstico mais específico
      const headers = dados.headers || {};
      const temAuth = Object.keys(headers).some(
        (k) => k.toLowerCase() === "authorization"
      );
      if (!temAuth) {
        return {
          ...base,
          problema: "Falha de autenticação na requisição",
          causa: "Header Authorization ausente — a requisição foi enviada sem credenciais",
          nivel: "alto",
          sugestoes: [
            "Adicionar o header 'Authorization: Bearer {token}' na requisição",
            "Verificar se o token está sendo lido corretamente do storage",
            "Checar se o fluxo de login está salvando o token antes da chamada",
          ],
          confianca: 0.95,
        };
      }
      return {
        ...base,
        problema: "Falha de autenticação na requisição",
        causa: "Token ausente, inválido ou expirado",
        nivel: "alto",
        sugestoes: [
          "Verificar se o header Authorization está presente",
          "Checar validade e expiração do token",
          "Renovar o token de acesso",
        ],
      };
    }
    if (status === 403) {
      return {
        ...base,
        problema: "Acesso negado",
        causa: "Usuário autenticado mas sem permissão",
        nivel: "médio",
        sugestoes: [
          "Verificar permissões do usuário",
          "Checar políticas de acesso no backend",
        ],
      };
    }
    if (status === 404) {
      return {
        ...base,
        problema: "Endpoint não encontrado",
        causa: "URL incorreta ou recurso removido",
        nivel: "médio",
        sugestoes: [
          "Verificar se a URL está correta",
          "Confirmar se o endpoint ainda existe no backend",
        ],
      };
    }
    if (status >= 500) {
      return {
        ...base,
        problema: "Erro interno no servidor",
        causa: "O backend retornou um erro não tratado",
        nivel: "alto",
        sugestoes: [
          "Verificar logs do servidor",
          "Checar se a resposta é JSON válido",
          "Adicionar tratamento de erro no frontend para status 5xx",
        ],
      };
    }
    return {
      ...base,
      problema: "Requisição falhou",
      causa: `Status HTTP ${status || "desconhecido"}`,
      nivel: "médio",
      sugestoes: ["Verificar resposta da API", "Adicionar tratamento de erro adequado"],
    };
  }
```

**IMPORTANTE:** Após o bloco `if (status === 401)` modificado acima, manter os demais blocos de status (403, 404, 500+) e o fallback final exatamente como estão no arquivo original.

No bloco `if (tipo === "silent_error")`, substituir pelo código com análise de mensagem:

```js
  if (tipo === "silent_error") {
    const msg = mensagem;
    let causa = "Erro capturado mas não tratado ou exibido";
    let confianca = 0.85;
    const sugestoes = [
      "Adicionar .catch() em todas as Promises",
      "Nunca deixar bloco catch vazio",
      "Logar erros e notificar o usuário quando apropriado",
    ];

    if (msg.includes("TypeError") || msg.includes("Cannot read propert")) {
      causa = "TypeError: acesso a propriedade de valor null ou undefined — dado não inicializado antes do uso";
      confianca = 0.95;
      sugestoes.unshift("Verificar se o dado existe antes de acessar propriedades: if (data && data.prop)");
    } else if (msg.includes("ReferenceError") || msg.includes("is not defined")) {
      causa = "ReferenceError: variável ou módulo referenciado antes de ser declarado ou importado";
      confianca = 0.95;
      sugestoes.unshift("Verificar imports e a ordem de declaração das variáveis");
    } else if (msg.includes("SyntaxError")) {
      causa = "SyntaxError: JSON inválido ou código com erro de sintaxe sendo avaliado dinamicamente";
      confianca = 0.93;
    }

    return {
      ...base,
      problema: "Erro silencioso detectado",
      causa,
      nivel: "médio",
      sugestoes,
      confianca,
    };
  }
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
npx jest tests/engines/frontend.test.js --no-coverage
```

Saída esperada: todos os 14 testes PASS.

- [ ] **Step 5: Rodar a suite completa para confirmar sem regressões**

```bash
npx jest --no-coverage
```

Saída esperada: todos os testes PASS.

- [ ] **Step 6: Commit e push**

```bash
git add src/engines/frontend.js tests/engines/frontend.test.js
git commit -m "feat: engine frontend analisa stack trace, CORS, headers e tipo de erro específico"
git push origin master
```

---

## Verificação final

Após o Render fazer o deploy, testar com um payload rico:

```bash
curl -s -X POST https://devinsight-api.onrender.com/v1/diagnosticos \
  -H "Authorization: Bearer {SUA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "hydration_error",
    "mensagem": "Hydration failed",
    "dados": {
      "stack": "ReferenceError: window is not defined at MyComponent (MyComponent.jsx:8)"
    }
  }'
```

Resposta esperada: `causa` específica sobre acesso a `window` no SSR, não a mensagem genérica anterior.
