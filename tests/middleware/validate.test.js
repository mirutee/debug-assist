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
