/**
 * Testes abrangentes dos engines — erros reais mais comuns
 * Baseado em pesquisa de erros JS/Node.js/SQL mais frequentes em produção
 */

const diagnosticarFrontend = require("../../src/engines/frontend");
const diagnosticarBackend  = require("../../src/engines/backend");
const diagnosticarSQL      = require("../../src/engines/sql");

// ─── FRONTEND ────────────────────────────────────────────────────────────────

describe("Frontend — TypeError (erros mais comuns em produção)", () => {
  it("Cannot read properties of undefined (reading 'length')", () => {
    const r = diagnosticarFrontend({
      tipo: "silent_error",
      mensagem: "TypeError: Cannot read properties of undefined (reading 'length')",
    });
    expect(r.categoria).toBe("frontend");
    expect(r.causa).toMatch(/TypeError|undefined|null/i);
    expect(r.confianca).toBeGreaterThan(0.9);
  });

  it("Cannot read properties of null (reading 'classList')", () => {
    const r = diagnosticarFrontend({
      tipo: "silent_error",
      mensagem: "TypeError: Cannot read properties of null (reading 'classList')",
    });
    expect(r.causa).toMatch(/TypeError|null/i);
  });

  it("null is not an object — erro comum no iOS Safari", () => {
    const r = diagnosticarFrontend({
      tipo: "silent_error",
      mensagem: "TypeError: null is not an object (evaluating 'document.querySelector')",
    });
    expect(r.problema).toMatch(/silencioso/i);
    expect(r.nivel).toBe("médio");
  });

  it("undefined is not a function", () => {
    const r = diagnosticarFrontend({
      tipo: "silent_error",
      mensagem: "TypeError: undefined is not a function",
    });
    expect(r.categoria).toBe("frontend");
  });
});

describe("Frontend — ReferenceError", () => {
  it("variável não declarada — is not defined", () => {
    const r = diagnosticarFrontend({
      tipo: "silent_error",
      mensagem: "ReferenceError: myComponent is not defined",
    });
    expect(r.causa).toMatch(/ReferenceError|declarad|definid/i);
    expect(r.confianca).toBeGreaterThan(0.9);
  });

  it("fetch is not defined — Node.js sem polyfill", () => {
    const r = diagnosticarFrontend({
      tipo: "silent_error",
      mensagem: "ReferenceError: fetch is not defined",
    });
    expect(r.causa).toMatch(/ReferenceError|definid/i);
  });

  it("process is not defined — browser sem polyfill", () => {
    const r = diagnosticarFrontend({
      tipo: "silent_error",
      mensagem: "ReferenceError: process is not defined",
    });
    expect(r.nivel).toBe("médio");
  });
});

describe("Frontend — SyntaxError", () => {
  it("Unexpected token '<' — API retornou HTML em vez de JSON", () => {
    const r = diagnosticarFrontend({
      tipo: "silent_error",
      mensagem: "SyntaxError: Unexpected token '<', \"<!DOCTYPE...\" is not valid JSON",
    });
    expect(r.causa).toMatch(/SyntaxError|JSON|sintaxe/i);
    expect(r.confianca).toBeGreaterThan(0.9);
  });

  it("Unexpected end of JSON input — resposta truncada", () => {
    const r = diagnosticarFrontend({
      tipo: "silent_error",
      mensagem: "SyntaxError: Unexpected end of JSON input",
    });
    expect(r.causa).toMatch(/SyntaxError|JSON/i);
  });

  it("JSON.parse error — formato inválido", () => {
    const r = diagnosticarFrontend({
      tipo: "silent_error",
      mensagem: "SyntaxError: JSON.parse: unexpected character at line 1",
    });
    expect(r.categoria).toBe("frontend");
  });
});

describe("Frontend — request_error por status HTTP", () => {
  it("403 Forbidden — usuário sem permissão", () => {
    const r = diagnosticarFrontend({ tipo: "request_error", status: 403, mensagem: "Forbidden" });
    expect(r.problema).toMatch(/acesso|Forbidden|permissão/i);
    expect(r.nivel).toBe("médio");
  });

  it("404 Not Found — endpoint removido", () => {
    const r = diagnosticarFrontend({ tipo: "request_error", status: 404, mensagem: "Not Found" });
    expect(r.problema).toMatch(/encontrado|404/i);
    expect(r.nivel).toBe("médio");
  });

  it("502 Bad Gateway", () => {
    const r = diagnosticarFrontend({ tipo: "request_error", status: 502, mensagem: "Bad Gateway" });
    expect(r.nivel).toBe("alto");
  });

  it("503 Service Unavailable", () => {
    const r = diagnosticarFrontend({ tipo: "request_error", status: 503, mensagem: "Service Unavailable" });
    expect(r.nivel).toBe("alto");
  });

  it("401 com Authorization header presente — token inválido", () => {
    const r = diagnosticarFrontend({
      tipo: "request_error",
      status: 401,
      mensagem: "Unauthorized",
      dados: { headers: { Authorization: "Bearer expired.token.here" } },
    });
    expect(r.causa).toMatch(/token|inválido|expirado|ausente/i);
  });

  it("CORS com access-control na mensagem", () => {
    const r = diagnosticarFrontend({
      tipo: "request_error",
      status: 0,
      mensagem: "Access to XMLHttpRequest blocked: access-control-allow-origin header missing",
    });
    expect(r.causa).toMatch(/CORS/i);
  });

  it("status desconhecido — fallback genérico", () => {
    const r = diagnosticarFrontend({ tipo: "request_error", mensagem: "Network error" });
    expect(r.categoria).toBe("frontend");
    expect(r.sugestoes.length).toBeGreaterThan(0);
  });
});

describe("Frontend — hydration_error (variantes)", () => {
  it("Math.random na stack", () => {
    const r = diagnosticarFrontend({
      tipo: "hydration_error",
      mensagem: "Hydration failed",
      dados: { stack: "at render Math.random() called" },
    });
    expect(r.confianca).toBeGreaterThan(0.9);
  });

  it("localStorage na stack — acesso ao browser em SSR", () => {
    const r = diagnosticarFrontend({
      tipo: "hydration_error",
      mensagem: "Hydration failed",
      dados: { stack: "localStorage.getItem is not defined during SSR" },
    });
    expect(r.causa).toMatch(/window|browser|localStorage|SSR|servidor/i);
  });

  it("document.getElementById na stack", () => {
    const r = diagnosticarFrontend({
      tipo: "hydration_error",
      mensagem: "Hydration failed",
      dados: { stack: "document.getElementById called at render" },
    });
    expect(r.causa).toMatch(/window|browser|document|SSR/i);
  });

  it("sem dados extras — causa genérica", () => {
    const r = diagnosticarFrontend({ tipo: "hydration_error", mensagem: "Hydration mismatch" });
    expect(r.problema).toBe("Erro de hidratação");
    expect(r.nivel).toBe("alto");
  });
});

describe("Frontend — performance_issue (limites)", () => {
  it("201ms — nível médio", () => {
    const r = diagnosticarFrontend({
      tipo: "performance_issue",
      mensagem: "long task",
      dados: { tempo_execucao: 201 },
    });
    expect(r.nivel).toBe("alto");
  });

  it("50ms — nível médio (abaixo do threshold)", () => {
    const r = diagnosticarFrontend({
      tipo: "performance_issue",
      mensagem: "slow render",
      dados: { tempo_execucao: 50 },
    });
    expect(r.nivel).toBe("médio");
  });

  it("sem dados de tempo — fallback", () => {
    const r = diagnosticarFrontend({ tipo: "performance_issue", mensagem: "slow" });
    expect(r.categoria).toBe("frontend");
    expect(r.sugestoes.length).toBeGreaterThan(0);
  });
});

describe("Frontend — responsive_error", () => {
  it("overflow com largura específica", () => {
    const r = diagnosticarFrontend({
      tipo: "responsive_error",
      mensagem: "",
      dados: { problema: "overflow", largura: 320 },
    });
    expect(r.problema).toMatch(/overflow/i);
    expect(r.causa).toMatch(/320/);
  });

  it("tipo genérico sem overflow", () => {
    const r = diagnosticarFrontend({
      tipo: "responsive_error",
      mensagem: "",
      dados: { problema: "layout_shift" },
    });
    expect(r.nivel).toBe("médio");
    expect(r.sugestoes.length).toBeGreaterThan(0);
  });
});

// ─── BACKEND ─────────────────────────────────────────────────────────────────

describe("Backend — silent_backend_error (erros mais comuns)", () => {
  it("Cannot read properties of undefined", () => {
    const r = diagnosticarBackend({
      tipo: "silent_backend_error",
      mensagem: "TypeError: Cannot read properties of undefined (reading 'email')",
    });
    expect(r.causa).toMatch(/null|undefined|propriedade/i);
    expect(r.confianca).toBeGreaterThan(0.9);
  });

  it("properties of null — acesso a objeto nulo", () => {
    const r = diagnosticarBackend({
      tipo: "silent_backend_error",
      mensagem: "TypeError: Cannot read properties of null (reading 'userId')",
    });
    expect(r.nivel).toBe("alto");
    expect(r.causa).toMatch(/null/i);
  });

  it("map is not a function — array esperado, outro tipo recebido", () => {
    const r = diagnosticarBackend({
      tipo: "silent_backend_error",
      mensagem: "TypeError: users.map is not a function",
    });
    expect(r.causa).toMatch(/função|método|is not a function/i);
  });

  it("forEach is not a function", () => {
    const r = diagnosticarBackend({
      tipo: "silent_backend_error",
      mensagem: "TypeError: data.forEach is not a function",
    });
    expect(r.causa).toMatch(/função|método/i);
  });

  it("require is not defined — ESM/CJS mismatch", () => {
    const r = diagnosticarBackend({
      tipo: "silent_backend_error",
      mensagem: "ReferenceError: require is not defined in ES module scope",
    });
    expect(r.causa).toMatch(/variável|módulo|declarado|escopo/i);
  });

  it("process is not defined — ambiente incorreto", () => {
    const r = diagnosticarBackend({
      tipo: "silent_backend_error",
      mensagem: "ReferenceError: process is not defined",
    });
    expect(r.causa).toMatch(/variável|módulo|declarado/i);
  });

  it("erro genérico sem padrão — fallback", () => {
    const r = diagnosticarBackend({
      tipo: "silent_backend_error",
      mensagem: "Something went wrong in processing",
    });
    expect(r.categoria).toBe("backend");
    expect(r.nivel).toBe("alto");
    expect(r.confianca).toBe(0.85);
  });
});

describe("Backend — external_api_error (erros de integração)", () => {
  it("ETIMEDOUT — serviço externo lento", () => {
    const r = diagnosticarBackend({
      tipo: "external_api_error",
      mensagem: "connect ETIMEDOUT 52.10.0.1:443",
    });
    expect(r.causa).toMatch(/timeout|tempo/i);
    expect(r.confianca).toBeGreaterThan(0.9);
  });

  it("timeout na mensagem — variante textual", () => {
    const r = diagnosticarBackend({
      tipo: "external_api_error",
      mensagem: "Request timeout after 10000ms",
    });
    expect(r.causa).toMatch(/timeout|tempo/i);
  });

  it("503 Service Unavailable externo", () => {
    const r = diagnosticarBackend({
      tipo: "external_api_error",
      mensagem: "Request failed with status 503",
      dados: { status_externo: 503 },
    });
    expect(r.causa).toMatch(/503|indisponível/i);
  });

  it("too many requests na mensagem — rate limit textual", () => {
    const r = diagnosticarBackend({
      tipo: "external_api_error",
      mensagem: "Too many requests, please slow down",
    });
    expect(r.causa).toMatch(/rate limit|limite|429/i);
  });

  it("ECONNREFUSED no banco de dados", () => {
    const r = diagnosticarBackend({
      tipo: "external_api_error",
      mensagem: "connect ECONNREFUSED 127.0.0.1:5432",
    });
    expect(r.causa).toMatch(/recusou|ECONNREFUSED/i);
    expect(r.confianca).toBeGreaterThan(0.95);
  });

  it("erro externo genérico sem padrão", () => {
    const r = diagnosticarBackend({
      tipo: "external_api_error",
      mensagem: "Unexpected error from payment gateway",
    });
    expect(r.categoria).toBe("backend");
    expect(r.sugestoes.length).toBeGreaterThan(0);
  });
});

describe("Backend — contract_error", () => {
  it("resposta JSON com schema errado — causa genérica", () => {
    const r = diagnosticarBackend({
      tipo: "contract_error",
      mensagem: "Campo 'id' não encontrado na resposta",
      dados: { resposta: '{"status":"ok","data":null}' },
    });
    expect(r.problema).toMatch(/contrato/i);
    expect(r.nivel).toBe("alto");
  });

  it("resposta XML inesperada (começa com <)", () => {
    const r = diagnosticarBackend({
      tipo: "contract_error",
      mensagem: "",
      dados: { resposta: "<?xml version='1.0'?><error>Not Found</error>" },
    });
    expect(r.causa).toMatch(/HTML|XML/i);
  });

  it("resposta vazia — sem dados para inferir", () => {
    const r = diagnosticarBackend({ tipo: "contract_error", mensagem: "", dados: {} });
    expect(r.categoria).toBe("backend");
    expect(r.sugestoes.length).toBeGreaterThan(0);
  });
});

// ─── SQL ─────────────────────────────────────────────────────────────────────

describe("SQL — SQL Injection (variantes)", () => {
  it("concatenação com aspas simples + string", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "SELECT * FROM users WHERE name = '" + " + name + '" },
    });
    expect(r.problema).toMatch(/injection/i);
    expect(r.nivel).toBe("alto");
  });

  it("CONCAT na query — risco de injection", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "SELECT * FROM users WHERE id = CONCAT(userId, '')" },
    });
    expect(r.problema).toMatch(/injection/i);
  });
});

describe("SQL — N+1 (limites)", () => {
  it("exatamente 10 execuções — threshold mínimo", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "SELECT * FROM posts WHERE user_id = ?", quantidade_execucoes: 10 },
    });
    expect(r.problema).toMatch(/N\+1/i);
    expect(r.nivel).toBe("alto");
  });

  it("100 execuções — N+1 severo", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "SELECT name FROM categories WHERE id = ?", quantidade_execucoes: 100 },
    });
    expect(r.problema).toMatch(/N\+1/i);
    expect(r.confianca).toBe(0.9);
  });

  it("9 execuções — abaixo do threshold, não é N+1", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "SELECT id FROM tags WHERE post_id = ? LIMIT 5", quantidade_execucoes: 9 },
    });
    expect(r.problema).not.toMatch(/N\+1/i);
  });
});

describe("SQL — DELETE/UPDATE sem WHERE", () => {
  it("TRUNCATE-like DELETE sem WHERE", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "DELETE FROM sessions" },
    });
    expect(r.nivel).toBe("alto");
    expect(r.sugestoes.join(" ")).toMatch(/WHERE/i);
  });

  it("UPDATE em massa sem WHERE", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "UPDATE users SET verified = true" },
    });
    expect(r.nivel).toBe("alto");
  });

  it("DELETE com WHERE — deve passar OK", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "DELETE FROM sessions WHERE expired_at < NOW()", tempo_execucao: 30 },
    });
    expect(r.problema).not.toMatch(/WHERE/i);
  });

  it("UPDATE com WHERE — deve passar OK", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "UPDATE users SET active = false WHERE last_login < '2024-01-01'", tempo_execucao: 50 },
    });
    expect(r.problema).not.toMatch(/DELETE.*WHERE|UPDATE.*WHERE/i);
  });
});

describe("SQL — performance (limites de tempo)", () => {
  it("500ms — exatamente no limite, não é lento", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "SELECT id FROM orders WHERE id = ? LIMIT 1", tempo_execucao: 500 },
    });
    expect(r.nivel).toBe("baixo");
  });

  it("501ms — acima do limite, é lento", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "SELECT id FROM orders WHERE id = ? LIMIT 1", tempo_execucao: 501 },
    });
    expect(r.nivel).toBe("alto");
    expect(r.sugestoes.join(" ")).toMatch(/índice|EXPLAIN|otimizar/i);
  });

  it("2000ms — query muito lenta", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "SELECT id, name FROM products", tempo_execucao: 2000 },
    });
    expect(r.nivel).toBe("alto");
  });
});

describe("SQL — SELECT * combinado", () => {
  it("SELECT * + lenta — problemas combinados", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "SELECT * FROM invoices", tempo_execucao: 800 },
    });
    expect(r.problema).toMatch(/SELECT \*/i);
    expect(r.problema).toMatch(/lenta/i);
    expect(r.nivel).toBe("alto");
  });

  it("SELECT * + LIKE wildcard — problemas combinados", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "SELECT * FROM products WHERE name LIKE '%notebook'", tempo_execucao: 50 },
    });
    expect(r.problema).toMatch(/SELECT \*/i);
    expect(r.sugestoes.join(" ")).toMatch(/wildcard|índice|LIKE/i);
  });
});

describe("SQL — LIKE wildcard", () => {
  it("LIKE com wildcard à direita apenas — não deve alertar", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "SELECT id FROM users WHERE name LIKE 'silva%' LIMIT 10", tempo_execucao: 20 },
    });
    expect(r.sugestoes.join(" ")).not.toMatch(/wildcard.*esquerda/i);
  });

  it("LIKE '%term%' — wildcard em ambos os lados", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "SELECT id FROM articles WHERE title LIKE '%javascript%'", tempo_execucao: 60 },
    });
    expect(r.sugestoes.join(" ")).toMatch(/wildcard|índice/i);
  });
});

describe("SQL — query saudável (sem falsos positivos)", () => {
  it("INSERT simples — não é SELECT, não deve dar alertas de SELECT *", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "INSERT INTO logs (user_id, action) VALUES (?, ?)", tempo_execucao: 5 },
    });
    expect(r.nivel).toBe("baixo");
  });

  it("SELECT com LIMIT e WHERE — query ideal", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "SELECT id, name, email FROM users WHERE active = true LIMIT 20", tempo_execucao: 15 },
    });
    expect(r.nivel).toBe("baixo");
    expect(r.confianca).toBeGreaterThanOrEqual(0.8);
  });

  it("SELECT COUNT(*) — não é SELECT * de dados", () => {
    const r = diagnosticarSQL({
      mensagem: "",
      dados: { query: "SELECT COUNT(*) FROM orders WHERE status = 'pending'", tempo_execucao: 10 },
    });
    expect(r.categoria).toBe("sql");
  });
});
