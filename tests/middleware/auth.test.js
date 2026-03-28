// tests/middleware/auth.test.js
jest.mock("../../src/db/supabase", () => ({
  getUsuarioByApiKey: jest.fn(),
  incrementarUso: jest.fn(),
  getUsuarioByAuthId: jest.fn(),
  saveDiagnostico: jest.fn(),
}));

const { getUsuarioByApiKey } = require("../../src/db/supabase");
const auth = require("../../src/middleware/auth");

function makeReqRes(authHeader) {
  const req = {
    headers: authHeader !== undefined ? { authorization: authHeader } : {},
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

beforeEach(() => jest.clearAllMocks());

describe("auth middleware", () => {
  it("retorna 401 quando Authorization não enviado", async () => {
    const { req, res, next } = makeReqRes(undefined);
    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ erro: "API Key obrigatória" });
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 401 quando scheme não é Bearer", async () => {
    const { req, res, next } = makeReqRes("Basic abc123");
    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ erro: "API Key obrigatória" });
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 401 quando API Key inválida", async () => {
    getUsuarioByApiKey.mockResolvedValue(null);
    const { req, res, next } = makeReqRes("Bearer key-inexistente");
    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ erro: "API Key inválida" });
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 429 quando cota mensal esgotada", async () => {
    getUsuarioByApiKey.mockResolvedValue({
      id: "u1",
      plano_id: "free",
      uso_mensal: 100,
      planos: { limite_mensal: 100 },
    });
    const { req, res, next } = makeReqRes("Bearer key-valida");
    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      erro: "Cota mensal esgotada. Faça upgrade do seu plano.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("chama next() para key válida dentro da cota", async () => {
    getUsuarioByApiKey.mockResolvedValue({
      id: "u1",
      plano_id: "free",
      uso_mensal: 50,
      planos: { limite_mensal: 100 },
    });
    const { req, res, next } = makeReqRes("Bearer key-valida");
    await auth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.usuario).toEqual({
      id: "u1",
      plano_id: "free",
      uso_mensal: 50,
      limite_mensal: 100,
      ai_key_encrypted: null,
      ai_provider: null,
    });
  });

  it("chama next() para plano enterprise (limite -1 = ilimitado)", async () => {
    getUsuarioByApiKey.mockResolvedValue({
      id: "u2",
      plano_id: "enterprise",
      uso_mensal: 99999,
      planos: { limite_mensal: -1 },
    });
    const { req, res, next } = makeReqRes("Bearer key-enterprise");
    await auth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.usuario).toEqual({
      id: "u2",
      plano_id: "enterprise",
      uso_mensal: 99999,
      limite_mensal: -1,
      ai_key_encrypted: null,
      ai_provider: null,
    });
  });

  it("retorna 500 quando usuario.planos é null (dados corrompidos)", async () => {
    getUsuarioByApiKey.mockResolvedValue({
      id: "u3",
      plano_id: "free",
      uso_mensal: 0,
      planos: null,
    });
    const { req, res, next } = makeReqRes("Bearer key-corrompida");
    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 500 quando getUsuarioByApiKey lança exceção", async () => {
    getUsuarioByApiKey.mockRejectedValue(new Error("DB connection failed"));
    const { req, res, next } = makeReqRes("Bearer key-valida");
    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ erro: "Erro interno. Tente novamente." });
    expect(next).not.toHaveBeenCalled();
  });
});
