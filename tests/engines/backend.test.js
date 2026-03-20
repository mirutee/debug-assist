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
