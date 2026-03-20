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
