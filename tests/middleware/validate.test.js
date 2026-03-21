// tests/middleware/validate.test.js
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

const HEADERS = { Authorization: "Bearer qualquer-api-key-valida" };

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
