// tests/routes/diagnosticos.test.js
jest.mock("../../src/db/supabase", () => ({
  saveDiagnostico: jest.fn().mockResolvedValue(undefined),
  getUsuarioByApiKey: jest.fn().mockResolvedValue({
    id: "user-test-uuid",
    plano_id: "free",
    uso_mensal: 10,
    planos: { limite_mensal: 100 },
  }),
  incrementarUso: jest.fn().mockResolvedValue(undefined),
  getUsuarioByAuthId: jest.fn(),
}));

const request = require("supertest");
const app = require("../../src/app");

const HEADERS = {
  "Content-Type": "application/json",
  Authorization: "Bearer qualquer-api-key-valida",
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

  it("retorna 429 quando cota esgotada", async () => {
    const { getUsuarioByApiKey } = require("../../src/db/supabase");
    getUsuarioByApiKey.mockResolvedValueOnce({
      id: "user-test-uuid",
      plano_id: "free",
      uso_mensal: 100,
      planos: { limite_mensal: 100 },
    });

    const res = await request(app)
      .post("/v1/diagnosticos")
      .set(HEADERS)
      .send({ tipo: "hydration_error", mensagem: "x" });

    expect(res.status).toBe(429);
  });
});
