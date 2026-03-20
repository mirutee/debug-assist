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
