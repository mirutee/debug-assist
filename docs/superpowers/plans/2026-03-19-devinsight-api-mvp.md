# DevInsight API — MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the DevInsight API MVP — um servidor Express que recebe erros via `POST /v1/diagnosticos` e retorna diagnósticos inteligentes para problemas de frontend, backend e SQL.

**Architecture:** Engine de diagnóstico baseada em regras (MVP sem IA), que analisa o campo `tipo` e propriedades do payload para retornar `problema`, `causa`, `nivel`, `categoria` e `sugestoes`. Auth via API Key (Bearer Token). Logs persistidos no Supabase.

**Tech Stack:** Node.js 20+, Express 4, Jest (testes), @supabase/supabase-js, dotenv, express-rate-limit, swagger-ui-express, yamljs

---

## Mapa de Arquivos

```
C:\PROJETOS\API\
├── src/
│   ├── app.js                  # Express setup (sem listen) — testável
│   ├── server.js               # Entry point (chama app.listen)
│   ├── routes/
│   │   ├── health.js           # GET /health
│   │   └── diagnosticos.js     # POST /v1/diagnosticos
│   ├── engines/
│   │   ├── index.js            # Dispatcher: chama engine certa pelo tipo
│   │   ├── frontend.js         # Regras: hydration, request, responsive, performance
│   │   ├── backend.js          # Regras: silent_backend_error, contract_error, external_api_error
│   │   └── sql.js              # Regras: sql_analysis (slow query, N+1, SELECT *, injection)
│   ├── middleware/
│   │   ├── auth.js             # Valida Authorization: Bearer <key>
│   │   └── validate.js         # Valida corpo da requisição (tipo + mensagem obrigatórios)
│   └── db/
│       └── supabase.js         # Cliente Supabase + função saveDiagnostico()
├── sdk/
│   ├── index.js                # reportError(data) — função de envio simples
│   └── package.json            # Pacote npm: devinsight-sdk
├── swagger.yaml                # OpenAPI 3.0 spec completo
├── tests/
│   ├── engines/
│   │   ├── frontend.test.js
│   │   ├── backend.test.js
│   │   ├── sql.test.js
│   │   └── index.test.js           # Testa o dispatcher
│   ├── routes/
│   │   ├── health.test.js
│   │   └── diagnosticos.test.js
│   ├── middleware/
│   │   ├── auth.test.js
│   │   └── validate.test.js
│   └── sdk/
│       └── sdk.test.js             # Testa o SDK
├── .env.example
├── package.json
└── jest.config.js
```

---

## Task 1: Setup do projeto

**Files:**
- Create: `package.json`
- Create: `jest.config.js`
- Create: `.env.example`
- Create: `src/app.js`
- Create: `src/server.js`

- [ ] **Step 1: Inicializar package.json**

```bash
cd C:\PROJETOS\API
npm init -y
```

- [ ] **Step 2: Instalar dependências de produção**

```bash
npm install express @supabase/supabase-js dotenv express-rate-limit swagger-ui-express yamljs
```

- [ ] **Step 3: Instalar dependências de desenvolvimento**

```bash
npm install --save-dev jest supertest
```

- [ ] **Step 4: Criar jest.config.js**

```js
// jest.config.js
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
};
```

- [ ] **Step 5: Adicionar scripts no package.json**

Editar `package.json` e adicionar:
```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "jest --runInBand"
  }
}
```

- [ ] **Step 6: Criar .env.example**

```env
# .env.example
PORT=3000
API_KEY=dev-secret-key-local
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_KEY=sua-anon-key
```

Copiar para `.env`:
```bash
cp .env.example .env
```

- [ ] **Step 7: Criar src/app.js**

```js
// src/app.js
require("dotenv").config();
const express = require("express");
const app = express();

app.use(express.json());

app.use("/health", require("./routes/health"));
app.use("/v1/diagnosticos", require("./routes/diagnosticos"));

module.exports = app;
```

- [ ] **Step 8: Criar src/server.js**

```js
// src/server.js
const app = require("./app");
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`DevInsight API rodando na porta ${PORT}`);
});
```

- [ ] **Step 9: Commit**

```bash
git init
git add package.json jest.config.js .env.example src/app.js src/server.js
git commit -m "chore: setup inicial do projeto Node.js + Express"
```

---

## Task 2: Rota de health check

**Files:**
- Create: `src/routes/health.js`
- Create: `tests/routes/health.test.js`

- [ ] **Step 1: Escrever teste falhando**

```js
// tests/routes/health.test.js
const request = require("supertest");
const app = require("../../src/app");

describe("GET /health", () => {
  it("retorna status 200 com ok: true", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Rodar teste e confirmar falha**

```bash
npm test -- tests/routes/health.test.js
```

Esperado: FAIL — `Cannot find module './routes/health'`

- [ ] **Step 3: Implementar a rota**

```js
// src/routes/health.js
const express = require("express");
const router = express.Router();

router.get("/", (_req, res) => {
  res.json({ ok: true });
});

module.exports = router;
```

- [ ] **Step 4: Rodar teste e confirmar aprovação**

```bash
npm test -- tests/routes/health.test.js
```

Esperado: PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes/health.js tests/routes/health.test.js
git commit -m "feat: adicionar rota GET /health"
```

---

## Task 3: Middleware de autenticação (API Key)

**Files:**
- Create: `src/middleware/auth.js`
- Create: `tests/middleware/auth.test.js`

- [ ] **Step 1: Escrever testes falhando**

```js
// tests/middleware/auth.test.js
const request = require("supertest");
const app = require("../../src/app");

describe("Auth middleware", () => {
  it("retorna 401 quando Authorization não enviado", async () => {
    const res = await request(app)
      .post("/v1/diagnosticos")
      .send({ tipo: "hydration_error", mensagem: "test" });
    expect(res.status).toBe(401);
    expect(res.body.erro).toBe("API Key obrigatória");
  });

  it("retorna 401 quando API Key inválida", async () => {
    const res = await request(app)
      .post("/v1/diagnosticos")
      .set("Authorization", "Bearer chave-errada")
      .send({ tipo: "hydration_error", mensagem: "test" });
    expect(res.status).toBe(401);
    expect(res.body.erro).toBe("API Key inválida");
  });
});
```

- [ ] **Step 2: Rodar testes e confirmar falha**

```bash
npm test -- tests/middleware/auth.test.js
```

Esperado: FAIL (rota não existe ainda)

- [ ] **Step 3: Implementar o middleware**

```js
// src/middleware/auth.js
function auth(req, res, next) {
  const header = req.headers["authorization"];

  if (!header) {
    return res.status(401).json({ erro: "API Key obrigatória" });
  }

  const token = header.replace("Bearer ", "").trim();

  if (token !== process.env.API_KEY) {
    return res.status(401).json({ erro: "API Key inválida" });
  }

  next();
}

module.exports = auth;
```

- [ ] **Step 4: Criar rota stub para os testes passarem**

```js
// src/routes/diagnosticos.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

router.post("/", auth, (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
```

- [ ] **Step 5: Rodar testes e confirmar aprovação**

```bash
npm test -- tests/middleware/auth.test.js
```

Esperado: PASS

- [ ] **Step 6: Commit**

```bash
git add src/middleware/auth.js src/routes/diagnosticos.js tests/middleware/auth.test.js
git commit -m "feat: adicionar middleware de autenticação por API Key"
```

---

## Task 4: Middleware de validação de requisição

**Files:**
- Create: `src/middleware/validate.js`
- Create: `tests/middleware/validate.test.js`

- [ ] **Step 1: Escrever testes falhando**

```js
// tests/middleware/validate.test.js
const request = require("supertest");
const app = require("../../src/app");

const HEADERS = { Authorization: `Bearer ${process.env.API_KEY || "dev-secret-key-local"}` };

describe("Validate middleware", () => {
  it("retorna 400 quando 'tipo' não enviado", async () => {
    const res = await request(app)
      .post("/v1/diagnosticos")
      .set(HEADERS)
      .send({ mensagem: "erro qualquer" });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/tipo/);
  });

  it("retorna 400 quando 'mensagem' não enviada", async () => {
    const res = await request(app)
      .post("/v1/diagnosticos")
      .set(HEADERS)
      .send({ tipo: "hydration_error" });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/mensagem/);
  });
});
```

- [ ] **Step 2: Rodar testes e confirmar falha**

```bash
npm test -- tests/middleware/validate.test.js
```

Esperado: FAIL — campos não são validados ainda

- [ ] **Step 3: Implementar o middleware**

```js
// src/middleware/validate.js
function validate(req, res, next) {
  const { tipo, mensagem } = req.body;

  if (!tipo) {
    return res.status(400).json({ erro: "Campo 'tipo' é obrigatório" });
  }

  if (!mensagem && req.body.dados === undefined) {
    return res.status(400).json({ erro: "Campo 'mensagem' é obrigatório" });
  }

  next();
}

module.exports = validate;
```

- [ ] **Step 4: Plugar o middleware na rota**

Editar `src/routes/diagnosticos.js`:

```js
// src/routes/diagnosticos.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");

router.post("/", auth, validate, (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
```

- [ ] **Step 5: Rodar testes e confirmar aprovação**

```bash
npm test -- tests/middleware/validate.test.js
```

Esperado: PASS

- [ ] **Step 6: Commit**

```bash
git add src/middleware/validate.js src/routes/diagnosticos.js tests/middleware/validate.test.js
git commit -m "feat: adicionar validação de campos obrigatórios"
```

---

## Task 5: Engine de diagnóstico — Frontend

**Files:**
- Create: `src/engines/frontend.js`
- Create: `tests/engines/frontend.test.js`

- [ ] **Step 1: Escrever testes falhando**

```js
// tests/engines/frontend.test.js
const diagnosticarFrontend = require("../../src/engines/frontend");

describe("Engine Frontend", () => {
  it("diagnostica hydration_error", () => {
    const resultado = diagnosticarFrontend({
      tipo: "hydration_error",
      mensagem: "Hydration failed because the initial UI does not match",
    });
    expect(resultado.problema).toBe("Erro de hidratação");
    expect(resultado.categoria).toBe("frontend");
    expect(resultado.nivel).toBe("alto");
    expect(resultado.sugestoes.length).toBeGreaterThan(0);
  });

  it("diagnostica request_error com status 401", () => {
    const resultado = diagnosticarFrontend({
      tipo: "request_error",
      mensagem: "Unauthorized",
      status: 401,
    });
    expect(resultado.problema).toMatch(/autenticação/i);
    expect(resultado.categoria).toBe("frontend");
  });

  it("diagnostica request_error com status 500", () => {
    const resultado = diagnosticarFrontend({
      tipo: "request_error",
      mensagem: "Internal Server Error",
      status: 500,
    });
    expect(resultado.nivel).toBe("alto");
  });

  it("diagnostica silent_error", () => {
    const resultado = diagnosticarFrontend({
      tipo: "silent_error",
      mensagem: "Promise rejected",
    });
    expect(resultado.problema).toMatch(/silencioso/i);
  });

  it("diagnostica responsive_error", () => {
    const resultado = diagnosticarFrontend({
      tipo: "responsive_error",
      mensagem: "overflow",
      dados: { largura: 375, problema: "overflow" },
    });
    expect(resultado.problema).toMatch(/layout/i);
    expect(resultado.categoria).toBe("frontend");
  });

  it("diagnostica performance_issue", () => {
    const resultado = diagnosticarFrontend({
      tipo: "performance_issue",
      mensagem: "long task",
      dados: { tempo_execucao: 200 },
    });
    expect(resultado.problema).toMatch(/performance/i);
  });

  it("retorna tipo desconhecido como diagnostico generico", () => {
    const resultado = diagnosticarFrontend({ tipo: "xyz", mensagem: "abc" });
    expect(resultado.categoria).toBe("frontend");
    expect(resultado.sugestoes).toBeDefined();
  });
});
```

- [ ] **Step 2: Rodar testes e confirmar falha**

```bash
npm test -- tests/engines/frontend.test.js
```

Esperado: FAIL — módulo não existe

- [ ] **Step 3: Implementar o engine**

```js
// src/engines/frontend.js
function diagnosticarFrontend({ tipo, mensagem = "", status, dados = {} }) {
  const base = { categoria: "frontend", confianca: 0.85 };

  if (tipo === "hydration_error") {
    return {
      ...base,
      problema: "Erro de hidratação",
      causa: "Diferença entre renderização no servidor (SSR) e no cliente",
      nivel: "alto",
      sugestoes: [
        "Evitar uso de Date.now(), Math.random() ou window no render",
        "Utilizar useEffect para dados que mudam apenas no cliente",
        "Garantir que dados do servidor e do cliente sejam consistentes",
      ],
    };
  }

  if (tipo === "request_error") {
    if (status === 401) {
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

  if (tipo === "silent_error") {
    return {
      ...base,
      problema: "Erro silencioso detectado",
      causa: "Erro capturado mas não tratado ou exibido",
      nivel: "médio",
      sugestoes: [
        "Adicionar .catch() em todas as Promises",
        "Nunca deixar bloco catch vazio",
        "Logar erros e notificar o usuário quando apropriado",
      ],
    };
  }

  if (tipo === "responsive_error") {
    const tipoProbema = dados.problema || "layout";
    if (tipoProbema === "overflow") {
      return {
        ...base,
        problema: "Layout quebrado — overflow horizontal",
        causa: `Conteúdo ultrapassa a largura da tela (${dados.largura || "?"}px)`,
        nivel: "médio",
        sugestoes: [
          "Usar unidades relativas (%, vw) em vez de px fixo",
          "Adicionar overflow-x: hidden no container pai",
          "Revisar media queries para telas pequenas",
        ],
      };
    }
    return {
      ...base,
      problema: "Problema de layout responsivo",
      causa: "Elemento não se adapta corretamente à resolução do usuário",
      nivel: "médio",
      sugestoes: [
        "Testar em múltiplas resoluções (375px, 768px, 1024px)",
        "Usar Flexbox ou Grid para layouts adaptativos",
        "Revisar uso de posicionamento absoluto",
      ],
    };
  }

  if (tipo === "performance_issue") {
    const tempo = dados.tempo_execucao || 0;
    return {
      ...base,
      problema: "Problema de performance no frontend",
      causa: tempo > 100 ? `Tarefa demorou ${tempo}ms (acima de 100ms bloqueia a UI)` : "Render ou interação lenta",
      nivel: tempo > 200 ? "alto" : "médio",
      sugestoes: [
        "Usar React.memo() ou useMemo para evitar re-renders desnecessários",
        "Evitar loops pesados na thread principal",
        "Mover processamento para Web Workers se necessário",
      ],
    };
  }

  return {
    ...base,
    problema: "Problema de frontend não classificado",
    causa: mensagem || "Informações insuficientes para diagnóstico preciso",
    nivel: "baixo",
    sugestoes: ["Enviar mais contexto (status, dados) para diagnóstico detalhado"],
    confianca: 0.4,
  };
}

module.exports = diagnosticarFrontend;
```

- [ ] **Step 4: Rodar testes e confirmar aprovação**

```bash
npm test -- tests/engines/frontend.test.js
```

Esperado: PASS (7 testes)

- [ ] **Step 5: Commit**

```bash
git add src/engines/frontend.js tests/engines/frontend.test.js
git commit -m "feat: implementar engine de diagnóstico para frontend"
```

---

## Task 6: Engine de diagnóstico — Backend

**Files:**
- Create: `src/engines/backend.js`
- Create: `tests/engines/backend.test.js`

- [ ] **Step 1: Escrever testes falhando**

```js
// tests/engines/backend.test.js
const diagnosticarBackend = require("../../src/engines/backend");

describe("Engine Backend", () => {
  it("diagnostica silent_backend_error", () => {
    const r = diagnosticarBackend({ tipo: "silent_backend_error", mensagem: "Unhandled exception" });
    expect(r.categoria).toBe("backend");
    expect(r.problema).toMatch(/silencioso/i);
    expect(r.sugestoes.length).toBeGreaterThan(0);
  });

  it("diagnostica contract_error", () => {
    const r = diagnosticarBackend({ tipo: "contract_error", mensagem: "Expected JSON got HTML" });
    expect(r.problema).toMatch(/contrato/i);
    expect(r.nivel).toBe("alto");
  });

  it("diagnostica external_api_error", () => {
    const r = diagnosticarBackend({ tipo: "external_api_error", mensagem: "timeout" });
    expect(r.problema).toMatch(/externa/i);
    expect(r.sugestoes.length).toBeGreaterThan(0);
  });

  it("retorna generico para tipo desconhecido", () => {
    const r = diagnosticarBackend({ tipo: "xyz", mensagem: "erro" });
    expect(r.categoria).toBe("backend");
  });
});
```

- [ ] **Step 2: Rodar testes e confirmar falha**

```bash
npm test -- tests/engines/backend.test.js
```

Esperado: FAIL

- [ ] **Step 3: Implementar o engine**

```js
// src/engines/backend.js
function diagnosticarBackend({ tipo, mensagem = "", dados = {} }) {
  const base = { categoria: "backend", confianca: 0.85 };

  if (tipo === "silent_backend_error") {
    return {
      ...base,
      problema: "Erro silencioso no backend",
      causa: "Exceção capturada mas não tratada adequadamente",
      nivel: "alto",
      sugestoes: [
        "Nunca deixar bloco catch vazio",
        "Logar stack trace completo do erro",
        "Retornar status HTTP adequado em vez de 200 com erro no body",
        "Implementar handler global de erros no Express",
      ],
    };
  }

  if (tipo === "contract_error") {
    return {
      ...base,
      problema: "Violação de contrato de API",
      causa: "Resposta não corresponde ao schema esperado",
      nivel: "alto",
      sugestoes: [
        "Validar resposta com Zod ou Joi antes de retornar ao cliente",
        "Verificar se o status HTTP corresponde ao conteúdo retornado",
        "Garantir que erros 5xx retornem JSON e não HTML",
        "Documentar e respeitar o OpenAPI spec",
      ],
    };
  }

  if (tipo === "external_api_error") {
    return {
      ...base,
      problema: "Falha em integração com API externa",
      causa: "Serviço externo indisponível ou com comportamento inesperado",
      nivel: "médio",
      sugestoes: [
        "Adicionar timeout explícito nas chamadas externas",
        "Implementar fallback ou retry com backoff exponencial",
        "Tratar erros da API externa separadamente dos erros internos",
        "Monitorar disponibilidade do serviço externo",
      ],
    };
  }

  return {
    ...base,
    problema: "Problema de backend não classificado",
    causa: mensagem || "Informações insuficientes",
    nivel: "baixo",
    sugestoes: ["Enviar mais contexto para diagnóstico detalhado"],
    confianca: 0.4,
  };
}

module.exports = diagnosticarBackend;
```

- [ ] **Step 4: Rodar testes e confirmar aprovação**

```bash
npm test -- tests/engines/backend.test.js
```

Esperado: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add src/engines/backend.js tests/engines/backend.test.js
git commit -m "feat: implementar engine de diagnóstico para backend"
```

---

## Task 7: Engine de diagnóstico — SQL

**Files:**
- Create: `src/engines/sql.js`
- Create: `tests/engines/sql.test.js`

- [ ] **Step 1: Escrever testes falhando**

```js
// tests/engines/sql.test.js
const diagnosticarSQL = require("../../src/engines/sql");

describe("Engine SQL", () => {
  it("detecta SELECT *", () => {
    const r = diagnosticarSQL({
      tipo: "sql_analysis",
      mensagem: "",
      dados: { query: "SELECT * FROM users", tempo_execucao: 100 },
    });
    expect(r.problema).toMatch(/SELECT \*/i);
    expect(r.categoria).toBe("sql");
  });

  it("detecta query lenta (> 500ms)", () => {
    const r = diagnosticarSQL({
      tipo: "sql_analysis",
      mensagem: "",
      dados: { query: "SELECT id FROM orders", tempo_execucao: 800 },
    });
    expect(r.problema).toMatch(/lenta/i);
    expect(r.nivel).toBe("alto");
  });

  it("detecta ausência de LIMIT", () => {
    const r = diagnosticarSQL({
      tipo: "sql_analysis",
      mensagem: "",
      dados: { query: "SELECT id, name FROM products WHERE active = true", tempo_execucao: 50 },
    });
    expect(r.sugestoes.join(" ")).toMatch(/LIMIT/i);
  });

  it("detecta possível SQL Injection", () => {
    const r = diagnosticarSQL({
      tipo: "sql_analysis",
      mensagem: "",
      dados: { query: "SELECT * FROM users WHERE id = ' + userId + '", tempo_execucao: 10 },
    });
    expect(r.problema).toMatch(/injection/i);
    expect(r.nivel).toBe("alto");
  });

  it("detecta N+1 por múltiplas queries similares", () => {
    const r = diagnosticarSQL({
      tipo: "sql_analysis",
      mensagem: "",
      dados: {
        query: "SELECT * FROM orders WHERE user_id = ?",
        quantidade_execucoes: 50,
        tempo_execucao: 20,
      },
    });
    expect(r.problema).toMatch(/N\+1/i);
  });

  it("retorna diagnóstico OK para query saudável", () => {
    const r = diagnosticarSQL({
      tipo: "sql_analysis",
      mensagem: "",
      dados: {
        query: "SELECT id, name FROM users WHERE id = ? LIMIT 10",
        tempo_execucao: 30,
      },
    });
    expect(r.nivel).toBe("baixo");
    expect(r.categoria).toBe("sql");
  });
});
```

- [ ] **Step 2: Rodar testes e confirmar falha**

```bash
npm test -- tests/engines/sql.test.js
```

Esperado: FAIL

- [ ] **Step 3: Implementar o engine**

```js
// src/engines/sql.js
function diagnosticarSQL({ mensagem = "", dados = {} }) {
  const base = { categoria: "sql" };
  const query = (dados.query || "").toUpperCase();
  const tempo = dados.tempo_execucao || 0;
  const execucoes = dados.quantidade_execucoes || 1;
  const sugestoes = [];
  const problemas = [];
  let nivel = "baixo";
  let confianca = 0.9;

  // SQL Injection — prioridade máxima
  if (query.includes("' +") || query.includes("\" +") || query.includes("+ '") || query.includes("CONCAT(")) {
    return {
      ...base,
      problema: "Risco de SQL Injection detectado",
      causa: "Query construída com concatenação de strings — vetor de ataque",
      nivel: "alto",
      sugestoes: [
        "Usar prepared statements / queries parametrizadas",
        "Nunca concatenar input do usuário diretamente na query",
        "Usar ORM como Prisma ou Sequelize",
      ],
      confianca: 0.95,
    };
  }

  // N+1
  if (execucoes >= 10) {
    return {
      ...base,
      problema: "N+1 Query detectado",
      causa: `Query executada ${execucoes} vezes — padrão N+1 identificado`,
      nivel: "alto",
      sugestoes: [
        "Usar JOIN para buscar dados relacionados em uma única query",
        "Carregar dados em lote (batch loading)",
        "Usar eager loading no ORM",
      ],
      confianca: 0.9,
    };
  }

  // Query lenta
  if (tempo > 500) {
    problemas.push("Query lenta");
    nivel = "alto";
    sugestoes.push(`Tempo de execução: ${tempo}ms — otimizar é urgente`);
    sugestoes.push("Verificar índices nas colunas do WHERE");
    sugestoes.push("Analisar EXPLAIN ANALYZE da query");
  }

  // SELECT *
  if (query.startsWith("SELECT *") || query.includes("SELECT *")) {
    problemas.push("SELECT * detectado");
    if (nivel === "baixo") nivel = "médio";
    sugestoes.push("Selecionar apenas as colunas necessárias");
    sugestoes.push("Reduz tráfego de rede e uso de memória");
  }

  // Sem LIMIT
  if (query.includes("SELECT") && !query.includes("LIMIT")) {
    sugestoes.push("Adicionar LIMIT para evitar retorno de grandes volumes de dados");
  }

  if (problemas.length === 0) {
    return {
      ...base,
      problema: "Nenhum problema crítico detectado",
      causa: "Query dentro dos parâmetros aceitáveis",
      nivel: "baixo",
      sugestoes: sugestoes.length > 0 ? sugestoes : ["Query parece saudável"],
      confianca: 0.8,
    };
  }

  return {
    ...base,
    problema: problemas.join(" + "),
    causa: mensagem || "Padrões problemáticos identificados na query",
    nivel,
    sugestoes,
    confianca,
  };
}

module.exports = diagnosticarSQL;
```

- [ ] **Step 4: Rodar testes e confirmar aprovação**

```bash
npm test -- tests/engines/sql.test.js
```

Esperado: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add src/engines/sql.js tests/engines/sql.test.js
git commit -m "feat: implementar engine de diagnóstico para SQL"
```

---

## Task 8: Dispatcher das engines

**Files:**
- Create: `src/engines/index.js`
- Create: `tests/engines/index.test.js`

- [ ] **Step 1: Escrever testes falhando**

```js
// tests/engines/index.test.js
const diagnosticar = require("../../src/engines/index");

describe("Engine Dispatcher", () => {
  it("roteia hydration_error para engine frontend", () => {
    const r = diagnosticar({ tipo: "hydration_error", mensagem: "Hydration failed" });
    expect(r.categoria).toBe("frontend");
  });

  it("roteia silent_backend_error para engine backend", () => {
    const r = diagnosticar({ tipo: "silent_backend_error", mensagem: "unhandled" });
    expect(r.categoria).toBe("backend");
  });

  it("roteia sql_analysis para engine SQL", () => {
    const r = diagnosticar({
      tipo: "sql_analysis",
      mensagem: "",
      dados: { query: "SELECT * FROM t", tempo_execucao: 100 },
    });
    expect(r.categoria).toBe("sql");
  });

  it("retorna categoria desconhecido para tipo não suportado", () => {
    const r = diagnosticar({ tipo: "tipo_invalido", mensagem: "x" });
    expect(r.categoria).toBe("desconhecido");
    expect(r.confianca).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar testes e confirmar falha**

```bash
npm test -- tests/engines/index.test.js
```

Esperado: FAIL — módulo não existe

- [ ] **Step 3: Implementar o dispatcher**

```js
// src/engines/index.js
const diagnosticarFrontend = require("./frontend");
const diagnosticarBackend = require("./backend");
const diagnosticarSQL = require("./sql");

const TIPOS_FRONTEND = ["hydration_error", "request_error", "silent_error", "responsive_error", "performance_issue"];
const TIPOS_BACKEND = ["silent_backend_error", "contract_error", "external_api_error"];
const TIPOS_SQL = ["sql_analysis"];

function diagnosticar(payload) {
  const { tipo } = payload;

  if (TIPOS_FRONTEND.includes(tipo)) return diagnosticarFrontend(payload);
  if (TIPOS_BACKEND.includes(tipo)) return diagnosticarBackend(payload);
  if (TIPOS_SQL.includes(tipo)) return diagnosticarSQL(payload);

  // Tipo desconhecido — retorna diagnóstico genérico
  return {
    categoria: "desconhecido",
    problema: "Tipo de diagnóstico não reconhecido",
    causa: `Tipo '${tipo}' não é suportado`,
    nivel: "baixo",
    sugestoes: [
      "Tipos suportados: hydration_error, request_error, silent_error, responsive_error, performance_issue, silent_backend_error, contract_error, external_api_error, sql_analysis",
    ],
    confianca: 0,
  };
}

module.exports = diagnosticar;
```

- [ ] **Step 4: Rodar testes e confirmar aprovação**

```bash
npm test -- tests/engines/index.test.js
```

Esperado: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add src/engines/index.js tests/engines/index.test.js
git commit -m "feat: adicionar dispatcher central das engines"
```

---

## Task 9: Rota POST /v1/diagnosticos (completa)

**Files:**
- Modify: `src/routes/diagnosticos.js`
- Create: `tests/routes/diagnosticos.test.js`

- [ ] **Step 1: Escrever testes de integração**

```js
// tests/routes/diagnosticos.test.js
const request = require("supertest");
const app = require("../../src/app");

const HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${process.env.API_KEY || "dev-secret-key-local"}`,
};

describe("POST /v1/diagnosticos", () => {
  it("retorna diagnóstico para hydration_error", async () => {
    const res = await request(app)
      .post("/v1/diagnosticos")
      .set(HEADERS)
      .send({ tipo: "hydration_error", mensagem: "Hydration failed" });

    expect(res.status).toBe(200);
    expect(res.body.problema).toBeDefined();
    expect(res.body.causa).toBeDefined();
    expect(res.body.nivel).toMatch(/baixo|médio|alto/);
    expect(res.body.categoria).toBe("frontend");
    expect(Array.isArray(res.body.sugestoes)).toBe(true);
  });

  it("retorna diagnóstico para sql_analysis", async () => {
    const res = await request(app)
      .post("/v1/diagnosticos")
      .set(HEADERS)
      .send({
        tipo: "sql_analysis",
        mensagem: "",
        dados: { query: "SELECT * FROM users", tempo_execucao: 900 },
      });

    expect(res.status).toBe(200);
    expect(res.body.categoria).toBe("sql");
  });

  it("retorna 400 sem campo tipo", async () => {
    const res = await request(app)
      .post("/v1/diagnosticos")
      .set(HEADERS)
      .send({ mensagem: "erro" });
    expect(res.status).toBe(400);
  });

  it("retorna 401 sem API Key", async () => {
    const res = await request(app)
      .post("/v1/diagnosticos")
      .send({ tipo: "hydration_error", mensagem: "x" });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Rodar testes e confirmar falha**

```bash
npm test -- tests/routes/diagnosticos.test.js
```

Esperado: FAIL — rota ainda é stub

- [ ] **Step 3: Implementar a rota completa**

```js
// src/routes/diagnosticos.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const diagnosticar = require("../engines/index");

router.post("/", auth, validate, async (req, res) => {
  try {
    const resultado = diagnosticar(req.body);
    return res.json(resultado);
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno ao processar diagnóstico" });
  }
});

module.exports = router;
```

- [ ] **Step 4: Rodar testes e confirmar aprovação**

```bash
npm test -- tests/routes/diagnosticos.test.js
```

Esperado: PASS (4 testes)

- [ ] **Step 5: Rodar todos os testes**

```bash
npm test
```

Esperado: todos PASS

- [ ] **Step 6: Commit**

```bash
git add src/routes/diagnosticos.js tests/routes/diagnosticos.test.js
git commit -m "feat: implementar rota POST /v1/diagnosticos completa"
```

---

## Task 10: Persistência no Supabase

**Files:**
- Create: `src/db/supabase.js`

> **Pré-requisito:** Criar projeto no Supabase (supabase.com) e executar o SQL abaixo no SQL Editor:
> ```sql
> CREATE TABLE diagnosticos (
>   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
>   tipo text NOT NULL,
>   mensagem text,
>   resposta jsonb NOT NULL,
>   contexto jsonb,
>   created_at timestamptz DEFAULT now()
> );
> ```
> Copiar `SUPABASE_URL` e `SUPABASE_KEY` (anon key) para o `.env`.

- [ ] **Step 1: Implementar o cliente Supabase**

```js
// src/db/supabase.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function saveDiagnostico({ tipo, mensagem, contexto, resposta }) {
  const { error } = await supabase
    .from("diagnosticos")
    .insert({ tipo, mensagem, contexto, resposta });

  if (error) {
    console.error("Erro ao salvar diagnóstico no Supabase:", error.message);
  }
}

module.exports = { saveDiagnostico };
```

- [ ] **Step 2: Plugar na rota (sem quebrar se Supabase falhar)**

Editar `src/routes/diagnosticos.js`:

```js
// src/routes/diagnosticos.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const diagnosticar = require("../engines/index");
const { saveDiagnostico } = require("../db/supabase");

router.post("/", auth, validate, async (req, res) => {
  try {
    const resultado = diagnosticar(req.body);

    // Persiste de forma assíncrona — não bloqueia a resposta
    saveDiagnostico({
      tipo: req.body.tipo,
      mensagem: req.body.mensagem,
      contexto: req.body.contexto,
      resposta: resultado,
    }).catch(() => {}); // silencia falha de log

    return res.json(resultado);
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno ao processar diagnóstico" });
  }
});

module.exports = router;
```

- [ ] **Step 3: Rodar todos os testes para confirmar nada quebrou**

```bash
npm test
```

Esperado: todos PASS (os testes não dependem do Supabase real)

- [ ] **Step 4: Commit**

```bash
git add src/db/supabase.js src/routes/diagnosticos.js
git commit -m "feat: persistir diagnósticos no Supabase de forma assíncrona"
```

---

## Task 11: SDK JavaScript

**Files:**
- Create: `sdk/package.json`
- Create: `sdk/index.js`
- Create: `tests/sdk/sdk.test.js`

- [ ] **Step 1: Escrever testes falhando**

```js
// tests/sdk/sdk.test.js
// Testa apenas a lógica de validação do SDK (sem chamada HTTP real)
// Substitui fetch por mock para não depender de servidor rodando

const { reportError } = require("../../sdk/index");

describe("SDK reportError", () => {
  it("lança erro quando apiKey não fornecida", async () => {
    await expect(
      reportError({ tipo: "hydration_error", mensagem: "x" }, undefined)
    ).rejects.toThrow("apiKey é obrigatória");
  });

  it("lança erro quando tipo não fornecido", async () => {
    await expect(
      reportError({ mensagem: "x" }, "minha-key")
    ).rejects.toThrow("'tipo' é obrigatório");
  });

  it("chama fetch com os dados corretos", async () => {
    const mockResponse = { ok: true, json: async () => ({ problema: "ok" }) };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const result = await reportError(
      { tipo: "hydration_error", mensagem: "teste" },
      "minha-api-key"
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/diagnosticos"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer minha-api-key" }),
      })
    );
    expect(result.problema).toBe("ok");

    delete global.fetch;
  });
});
```

- [ ] **Step 2: Rodar testes e confirmar falha**

```bash
npm test -- tests/sdk/sdk.test.js
```

Esperado: FAIL — módulo não existe

- [ ] **Step 3: Criar package.json do SDK**

```json
{
  "name": "devinsight-sdk",
  "version": "0.1.0",
  "description": "SDK oficial da DevInsight API",
  "main": "index.js",
  "keywords": ["debug", "diagnostics", "api"],
  "license": "MIT"
}
```

- [ ] **Step 4: Implementar o SDK**

```js
// sdk/index.js
const API_URL = "https://api.devinsight.com/v1/diagnosticos";

/**
 * Envia um erro para diagnóstico na DevInsight API.
 * @param {object} data - Payload do erro
 * @param {string} data.tipo - Tipo do erro (ex: "hydration_error")
 * @param {string} data.mensagem - Mensagem de erro original
 * @param {number} [data.status] - HTTP status (opcional)
 * @param {object} [data.contexto] - Informações adicionais (url, plataforma)
 * @param {object} [data.dados] - Dados técnicos (query SQL, largura de tela, etc.)
 * @param {string} apiKey - Sua API Key da DevInsight
 * @returns {Promise<object>} - Diagnóstico retornado
 */
async function reportError(data, apiKey) {
  if (!apiKey) throw new Error("DevInsight SDK: apiKey é obrigatória");
  if (!data.tipo) throw new Error("DevInsight SDK: campo 'tipo' é obrigatório");

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`DevInsight API error ${response.status}: ${err.erro || "desconhecido"}`);
  }

  return response.json();
}

module.exports = { reportError };
```

- [ ] **Step 5: Rodar testes do SDK e confirmar aprovação**

```bash
npm test -- tests/sdk/sdk.test.js
```

Esperado: PASS (3 testes)

- [ ] **Step 6: Commit**

```bash
git add sdk/ tests/sdk/sdk.test.js
git commit -m "feat: criar SDK JavaScript básico com testes (devinsight-sdk)"
```

---

## Task 12: Swagger UI integrado

**Files:**
- Create: `swagger.yaml`
- Modify: `src/app.js`

- [ ] **Step 1: Criar swagger.yaml** (baseado no spec do Prompt.txt)

```yaml
# swagger.yaml
openapi: 3.0.3
info:
  title: DevInsight API
  description: API de diagnóstico inteligente para frontend, backend e SQL.
  version: 1.0.0

servers:
  - url: http://localhost:3000
    description: Local
  - url: https://api.devinsight.com
    description: Produção

paths:
  /health:
    get:
      summary: Health check
      responses:
        "200":
          description: API operacional
          content:
            application/json:
              schema:
                type: object
                properties:
                  ok:
                    type: boolean
                    example: true

  /v1/diagnosticos:
    post:
      summary: Envia um erro para diagnóstico
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/DiagnosticoRequest"
            examples:
              hydration:
                summary: Erro de hidratação
                value:
                  tipo: hydration_error
                  mensagem: "Hydration failed because the initial UI does not match..."
              sql:
                summary: Query SQL lenta
                value:
                  tipo: sql_analysis
                  mensagem: ""
                  dados:
                    query: "SELECT * FROM users"
                    tempo_execucao: 900
      responses:
        "200":
          description: Diagnóstico gerado
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/DiagnosticoResponse"
        "400":
          description: Requisição inválida
        "401":
          description: Não autorizado

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
  schemas:
    DiagnosticoRequest:
      type: object
      required: [tipo]
      properties:
        tipo:
          type: string
          enum:
            - hydration_error
            - request_error
            - silent_error
            - responsive_error
            - performance_issue
            - silent_backend_error
            - contract_error
            - external_api_error
            - sql_analysis
        mensagem:
          type: string
        status:
          type: integer
        contexto:
          type: object
          properties:
            url:
              type: string
            plataforma:
              type: string
            framework:
              type: string
        dados:
          type: object
    DiagnosticoResponse:
      type: object
      properties:
        problema:
          type: string
          example: "Erro de hidratação"
        causa:
          type: string
        nivel:
          type: string
          enum: [baixo, médio, alto]
        categoria:
          type: string
          enum: [frontend, backend, sql, desconhecido]
        sugestoes:
          type: array
          items:
            type: string
        confianca:
          type: number
          minimum: 0
          maximum: 1
```

- [ ] **Step 2: Plugar Swagger UI no app.js**

Editar `src/app.js`:

```js
// src/app.js
require("dotenv").config();
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");

const app = express();
app.use(express.json());

const swaggerDocument = YAML.load(path.join(__dirname, "../swagger.yaml"));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/health", require("./routes/health"));
app.use("/v1/diagnosticos", require("./routes/diagnosticos"));

module.exports = app;
```

- [ ] **Step 3: Rodar todos os testes**

```bash
npm test
```

Esperado: todos PASS

- [ ] **Step 4: Testar manualmente**

```bash
npm start
# Abrir http://localhost:3000/docs
```

- [ ] **Step 5: Commit final**

```bash
git add swagger.yaml src/app.js
git commit -m "feat: integrar Swagger UI em /docs"
```

---

## Task 13: Smoke test end-to-end manual

- [ ] **Step 1: Iniciar servidor**

```bash
npm start
```

- [ ] **Step 2: Testar health check**

```bash
curl http://localhost:3000/health
```

Esperado: `{"ok":true}`

- [ ] **Step 3: Testar diagnóstico de hidratação**

```bash
curl -X POST http://localhost:3000/v1/diagnosticos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-secret-key-local" \
  -d '{"tipo":"hydration_error","mensagem":"Hydration failed"}'
```

Esperado: JSON com `problema`, `causa`, `nivel`, `sugestoes`

- [ ] **Step 4: Testar diagnóstico SQL**

```bash
curl -X POST http://localhost:3000/v1/diagnosticos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-secret-key-local" \
  -d '{"tipo":"sql_analysis","mensagem":"","dados":{"query":"SELECT * FROM users","tempo_execucao":900}}'
```

Esperado: JSON com `categoria: "sql"` e sugestões relevantes

- [ ] **Step 5: Confirmar erro 401**

```bash
curl -X POST http://localhost:3000/v1/diagnosticos \
  -H "Content-Type: application/json" \
  -d '{"tipo":"hydration_error","mensagem":"test"}'
```

Esperado: `{"erro":"API Key obrigatória"}`

- [ ] **Step 6: Commit final do MVP**

```bash
git add .
git commit -m "chore: MVP DevInsight API completo e funcionando"
```

---

## Resumo dos Tipos Suportados

| Tipo | Categoria | O que detecta |
|------|-----------|---------------|
| `hydration_error` | frontend | SSR ≠ cliente |
| `request_error` | frontend | 401, 403, 404, 5xx |
| `silent_error` | frontend | Promise sem .catch |
| `responsive_error` | frontend | Overflow, layout quebrado |
| `performance_issue` | frontend | Long tasks, UI travando |
| `silent_backend_error` | backend | Exceção ignorada |
| `contract_error` | backend | Resposta fora do schema |
| `external_api_error` | backend | API externa falhou |
| `sql_analysis` | sql | SELECT *, lentidão, N+1, injection |
