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

  it("silent_backend_error com ReferenceError 'is not defined'", () => {
    const r = diagnosticarBackend({
      tipo: "silent_backend_error",
      mensagem: "ReferenceError: db is not defined",
      dados: {},
    });
    expect(r.causa).toMatch(/variável|módulo|declarado|escopo/i);
    expect(r.confianca).toBe(0.92);
  });
});
