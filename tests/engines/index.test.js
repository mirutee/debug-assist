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
