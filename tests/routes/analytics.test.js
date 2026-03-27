// tests/routes/analytics.test.js
jest.mock("../../src/db/supabase", () => ({
  getUserFromToken: jest.fn(),
  getUsuarioByAuthId: jest.fn(),
  getAnalyticsByUsuario: jest.fn(),
}));

const { getUserFromToken, getUsuarioByAuthId, getAnalyticsByUsuario } =
  require("../../src/db/supabase");

beforeEach(() => jest.clearAllMocks());

const request = require("supertest");
const app = require("../../src/app");

describe("GET /v1/analytics", () => {
  it("retorna 401 sem token", async () => {
    const res = await request(app).get("/v1/analytics");
    expect(res.status).toBe(401);
  });

  it("retorna 401 com token inválido", async () => {
    getUserFromToken.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });

    const res = await request(app)
      .get("/v1/analytics")
      .set("Authorization", "Bearer token-invalido");

    expect(res.status).toBe(401);
  });

  it("retorna 404 se usuário não existe", async () => {
    getUserFromToken.mockResolvedValue({ data: { user: { id: "auth-uuid" } }, error: null });
    getUsuarioByAuthId.mockResolvedValue(null);

    const res = await request(app)
      .get("/v1/analytics")
      .set("Authorization", "Bearer token-valido");

    expect(res.status).toBe(404);
  });

  it("retorna 200 com array de dados", async () => {
    getUserFromToken.mockResolvedValue({ data: { user: { id: "auth-uuid" } }, error: null });
    getUsuarioByAuthId.mockResolvedValue({ id: "user-uuid" });
    getAnalyticsByUsuario.mockResolvedValue([
      { data: "2026-03-01", total: 5 },
      { data: "2026-03-02", total: 3 },
    ]);

    const res = await request(app)
      .get("/v1/analytics")
      .set("Authorization", "Bearer token-valido");

    expect(res.status).toBe(200);
    expect(res.body.dados).toHaveLength(2);
    expect(res.body.dados[0]).toEqual({ data: "2026-03-01", total: 5 });
  });

  it("retorna 200 com array vazio se sem diagnósticos", async () => {
    getUserFromToken.mockResolvedValue({ data: { user: { id: "auth-uuid" } }, error: null });
    getUsuarioByAuthId.mockResolvedValue({ id: "user-uuid" });
    getAnalyticsByUsuario.mockResolvedValue([]);

    const res = await request(app)
      .get("/v1/analytics")
      .set("Authorization", "Bearer token-valido");

    expect(res.status).toBe(200);
    expect(res.body.dados).toEqual([]);
  });
});
