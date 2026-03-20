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
