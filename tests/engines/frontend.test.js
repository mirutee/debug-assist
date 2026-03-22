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
});
