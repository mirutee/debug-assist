// tests/routes/diagnosticos.test.js
jest.mock('../../src/engines/aiEnricher', () =>
  jest.fn().mockImplementation(async (resultado) => resultado)
);

jest.mock("../../src/db/supabase", () => ({
  saveDiagnostico: jest.fn().mockResolvedValue(undefined),
  getUsuarioByApiKey: jest.fn().mockResolvedValue({
    id: "user-test-uuid",
    plano_id: "free",
    uso_mensal: 5,
    planos: { limite_mensal: 10 },
    ai_key_encrypted: null,
    ai_provider: null,
  }),
  incrementarUso: jest.fn().mockResolvedValue(undefined),
  getUsuarioByAuthId: jest.fn(),
  getUserFromToken: jest.fn(),
  getDiagnosticosByUsuario: jest.fn(),
}));

const request = require("supertest");
const app = require("../../src/app");
const { saveDiagnostico, getUsuarioByAuthId, getUserFromToken, getDiagnosticosByUsuario } = require("../../src/db/supabase");

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

  it("free: retorna apenas 1 sugestão com upgrade_hint", async () => {
    const res = await request(app)
      .post("/v1/diagnosticos")
      .set(HEADERS)
      .send({ tipo: "hydration_error", mensagem: "Hydration failed" });

    expect(res.status).toBe(200);
    expect(res.body.sugestoes).toHaveLength(1);
    expect(res.body.upgrade_hint).toBeDefined();
  });

  it("scale: chama aiEnricher e retorna resultado enriquecido", async () => {
    const { getUsuarioByApiKey } = require("../../src/db/supabase");
    const aiEnricher = require("../../src/engines/aiEnricher");

    getUsuarioByApiKey.mockResolvedValueOnce({
      id: "user-scale-uuid",
      plano_id: "scale",
      uso_mensal: 5,
      planos: { limite_mensal: 10000 },
      ai_key_encrypted: null,
      ai_provider: null,
    });

    aiEnricher.mockResolvedValueOnce({
      problema: "Erro de hidratação",
      causa: "Date.now() no render",
      nivel: "alto",
      categoria: "frontend",
      confianca: 0.97,
      sugestoes: ["Sugestão 1", "Sugestão 2"],
      analise_aprofundada: "Análise profunda gerada",
      ia_provider: "openai",
      ia_timeout: false,
    });

    const res = await request(app)
      .post("/v1/diagnosticos")
      .set(HEADERS)
      .send({ tipo: "hydration_error", mensagem: "Hydration failed" });

    expect(res.status).toBe(200);
    expect(aiEnricher).toHaveBeenCalledTimes(1);
    expect(res.body.analise_aprofundada).toBe("Análise profunda gerada");
  });

  it("retorna 429 quando cota esgotada", async () => {
    const { getUsuarioByApiKey } = require("../../src/db/supabase");
    getUsuarioByApiKey.mockResolvedValueOnce({
      id: "user-test-uuid",
      plano_id: "free",
      uso_mensal: 10,
      planos: { limite_mensal: 10 },
      ai_key_encrypted: null,
      ai_provider: null,
    });

    const res = await request(app)
      .post("/v1/diagnosticos")
      .set(HEADERS)
      .send({ tipo: "hydration_error", mensagem: "x" });

    expect(res.status).toBe(429);
  });
});

// --- historico ---

describe("GET /v1/diagnosticos/historico", () => {
  function mockJwtDiagnosticos() {
    getUserFromToken.mockResolvedValue({ data: { user: { id: "auth-uuid" } }, error: null });
    getUsuarioByAuthId.mockResolvedValue({ id: "user-test-uuid", email: "u@test.com", plano_id: "free", stripe_customer_id: null });
  }

  beforeEach(() => jest.clearAllMocks());

  it("retorna 401 sem token", async () => {
    const res = await request(app).get("/v1/diagnosticos/historico");
    expect(res.status).toBe(401);
  });

  it("retorna lista de diagnósticos para usuário autenticado", async () => {
    mockJwtDiagnosticos();
    getDiagnosticosByUsuario.mockResolvedValue([
      { id: "d1", tipo: "silent_backend_error", criado_em: "2026-03-23T10:00:00Z", resposta: { problema: "Erro", nivel: "alto" }, mensagem: "err", contexto: {} },
    ]);

    const res = await request(app)
      .get("/v1/diagnosticos/historico")
      .set("Authorization", "Bearer jwt-valido");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].id).toBe("d1");
  });

  it("passa parâmetro after quando fornecido", async () => {
    mockJwtDiagnosticos();
    getDiagnosticosByUsuario.mockResolvedValue([]);

    await request(app)
      .get("/v1/diagnosticos/historico?after=2026-03-23T10:00:00Z")
      .set("Authorization", "Bearer jwt-valido");

    expect(getDiagnosticosByUsuario).toHaveBeenCalledWith(
      "user-test-uuid",
      { after: "2026-03-23T10:00:00Z" }
    );
  });

  it("retorna 500 quando getDiagnosticosByUsuario lança erro", async () => {
    mockJwtDiagnosticos();
    getDiagnosticosByUsuario.mockRejectedValue(new Error("db down"));

    const res = await request(app)
      .get("/v1/diagnosticos/historico")
      .set("Authorization", "Bearer jwt-valido");

    expect(res.status).toBe(500);
    expect(res.body.erro).toBeDefined();
  });
});

describe("POST /v1/diagnosticos salva usuario_id", () => {
  it("chama saveDiagnostico com usuario_id do token", async () => {
    const res = await request(app)
      .post("/v1/diagnosticos")
      .set(HEADERS)
      .send({ tipo: "hydration_error", mensagem: "Hydration failed" });

    expect(res.status).toBe(200);
    expect(saveDiagnostico).toHaveBeenCalledWith(
      expect.objectContaining({ usuario_id: "user-test-uuid" })
    );
  });
});
