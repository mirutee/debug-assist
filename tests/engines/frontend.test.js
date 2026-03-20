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
