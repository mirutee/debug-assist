// tests/middleware/validate.test.js
jest.mock("../../src/db/supabase", () => ({
  saveDiagnostico: jest.fn().mockResolvedValue(undefined),
  getUsuarioByApiKey: jest.fn().mockResolvedValue({
    id: "user-test-uuid",
    plano_id: "free",
    uso_mensal: 10,
    planos: { limite_mensal: 100 },
  }),
  checkAndIncrementUso: jest.fn().mockResolvedValue(true),
  getUsuarioByAuthId: jest.fn(),
}));

const request = require("supertest");
const app = require("../../src/app");

// UUID válido — auth middleware rejeita API keys que não sejam UUID
const HEADERS = { Authorization: "Bearer a1b2c3d4-e5f6-7890-abcd-ef1234567890" };

describe("Validate middleware", () => {
  it("retorna 400 quando 'tipo' não enviado", async () => {
    const res = await request(app)
      .post("/v1/diagnosticos")
      .set(HEADERS)
      .send({ mensagem: "erro qualquer" });
    expect(res.status).toBe(400);
    expect(res.body.erro).toBe("Campo 'tipo' é obrigatório");
  });

  it("retorna 400 quando 'mensagem' não enviada", async () => {
    const res = await request(app)
      .post("/v1/diagnosticos")
      .set(HEADERS)
      .send({ tipo: "hydration_error" });
    expect(res.status).toBe(400);
    expect(res.body.erro).toBe("Campo 'mensagem' é obrigatório");
  });
});
