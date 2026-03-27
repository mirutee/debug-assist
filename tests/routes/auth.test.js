// tests/routes/auth.test.js
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
  signUpUser: jest.fn(),
  signInUser: jest.fn(),
  getUserFromToken: jest.fn(),
  regenerateApiKey: jest.fn(),
}));

const {
  signUpUser,
  signInUser,
  getUserFromToken,
  getUsuarioByAuthId,
  regenerateApiKey,
} = require("../../src/db/supabase");

jest.mock('../../src/email/resend', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
}));

const { sendWelcomeEmail } = require('../../src/email/resend');

beforeEach(() => jest.clearAllMocks());

const request = require("supertest");
const app = require("../../src/app");

describe("POST /v1/auth/signup", () => {
  it("retorna 201 para signup válido", async () => {
    signUpUser.mockResolvedValue({ data: {}, error: null });

    const res = await request(app)
      .post("/v1/auth/signup")
      .send({ email: "user@gmail.com", senha: "senha123" });

    expect(res.status).toBe(201);
    expect(res.body.mensagem).toMatch(/conta criada/i);
  });

  it("retorna 400 para email descartável", async () => {
    const res = await request(app)
      .post("/v1/auth/signup")
      .send({ email: "user@mailinator.com", senha: "senha123" });

    expect(res.status).toBe(400);
    expect(res.body.erro).toBe("Email não permitido");
  });

  it("retorna 400 para senha curta (< 6 caracteres)", async () => {
    const res = await request(app)
      .post("/v1/auth/signup")
      .send({ email: "user@gmail.com", senha: "abc" });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/senha/i);
  });

  it("retorna 400 para email já cadastrado", async () => {
    signUpUser.mockResolvedValue({
      data: {},
      error: { message: "User already registered" },
    });

    const res = await request(app)
      .post("/v1/auth/signup")
      .send({ email: "existing@gmail.com", senha: "senha123" });

    expect(res.status).toBe(400);
    expect(res.body.erro).toBe("Email já cadastrado");
  });

  it("retorna 400 para email inválido (sem @)", async () => {
    const res = await request(app)
      .post("/v1/auth/signup")
      .send({ email: "invalido", senha: "senha123" });

    expect(res.status).toBe(400);
  });

  it('chama sendWelcomeEmail com o email e api_key corretos após signup válido', async () => {
    signUpUser.mockResolvedValue({
      data: { user: { id: 'auth-uuid' } },
      error: null,
    });
    getUsuarioByAuthId.mockResolvedValue({ api_key: 'key-abc123' });

    await request(app)
      .post('/v1/auth/signup')
      .send({ email: 'user@gmail.com', senha: 'senha123' });

    expect(sendWelcomeEmail).toHaveBeenCalledWith('user@gmail.com', 'key-abc123');
  });

  it('retorna 201 mesmo quando sendWelcomeEmail lança erro', async () => {
    signUpUser.mockResolvedValue({
      data: { user: { id: 'auth-uuid' } },
      error: null,
    });
    getUsuarioByAuthId.mockResolvedValue({ api_key: 'key-abc123' });
    sendWelcomeEmail.mockRejectedValueOnce(new Error('resend error'));

    const res = await request(app)
      .post('/v1/auth/signup')
      .send({ email: 'user@gmail.com', senha: 'senha123' });

    expect(res.status).toBe(201);
  });
});

describe("POST /v1/auth/login", () => {
  it("retorna 200 com token para login válido", async () => {
    signInUser.mockResolvedValue({
      data: { session: { access_token: "jwt-token-aqui" } },
      error: null,
    });

    const res = await request(app)
      .post("/v1/auth/login")
      .send({ email: "user@gmail.com", senha: "senha123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe("jwt-token-aqui");
    expect(res.body.token_type).toBe("Bearer");
  });

  it("retorna 401 para credenciais inválidas", async () => {
    signInUser.mockResolvedValue({
      data: {},
      error: { message: "Invalid login credentials" },
    });

    const res = await request(app)
      .post("/v1/auth/login")
      .send({ email: "user@gmail.com", senha: "errada" });

    expect(res.status).toBe(401);
    expect(res.body.erro).toBe("Email ou senha incorretos");
  });

  it("retorna 403 para email não confirmado", async () => {
    signInUser.mockResolvedValue({
      data: {},
      error: { message: "Email not confirmed" },
    });

    const res = await request(app)
      .post("/v1/auth/login")
      .send({ email: "user@gmail.com", senha: "senha123" });

    expect(res.status).toBe(403);
    expect(res.body.erro).toMatch(/confirme/i);
  });
});

describe("GET /v1/auth/me", () => {
  it("retorna dados do usuário com token válido", async () => {
    getUserFromToken.mockResolvedValue({
      data: { user: { id: "auth-uuid" } },
      error: null,
    });

    getUsuarioByAuthId.mockResolvedValue({
      email: "user@gmail.com",
      api_key: "key-uuid",
      plano_id: "free",
      uso_mensal: 10,
      planos: { limite_mensal: 100 },
    });

    const res = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", "Bearer jwt-valido");

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("user@gmail.com");
    expect(res.body.api_key).toBe("key-uuid");
    expect(res.body.plano).toBe("free");
    expect(res.body.uso_mensal).toBe(10);
    expect(res.body.limite_mensal).toBe(100);
  });

  it("retorna 401 sem Authorization header", async () => {
    const res = await request(app).get("/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("retorna 401 para JWT inválido", async () => {
    getUserFromToken.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid token" },
    });

    const res = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", "Bearer jwt-invalido");

    expect(res.status).toBe(401);
  });

  it("retorna 404 quando usuário não confirmou email", async () => {
    getUserFromToken.mockResolvedValue({
      data: { user: { id: "auth-uuid" } },
      error: null,
    });

    getUsuarioByAuthId.mockResolvedValue(null);

    const res = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", "Bearer jwt-valido");

    expect(res.status).toBe(404);
    expect(res.body.erro).toMatch(/confirme/i);
  });
});

describe("POST /v1/auth/regenerate-key", () => {
  it("retorna 401 sem token", async () => {
    const res = await request(app).post("/v1/auth/regenerate-key");
    expect(res.status).toBe(401);
  });

  it("retorna 401 com token inválido", async () => {
    getUserFromToken.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });

    const res = await request(app)
      .post("/v1/auth/regenerate-key")
      .set("Authorization", "Bearer token-invalido");

    expect(res.status).toBe(401);
  });

  it("retorna 404 se usuário não existe na tabela usuarios", async () => {
    getUserFromToken.mockResolvedValue({ data: { user: { id: "auth-uuid" } }, error: null });
    getUsuarioByAuthId.mockResolvedValue(null);

    const res = await request(app)
      .post("/v1/auth/regenerate-key")
      .set("Authorization", "Bearer token-valido");

    expect(res.status).toBe(404);
  });

  it("retorna 200 com nova api_key", async () => {
    getUserFromToken.mockResolvedValue({ data: { user: { id: "auth-uuid" } }, error: null });
    getUsuarioByAuthId.mockResolvedValue({ id: "user-uuid", email: "user@exemplo.com" });
    regenerateApiKey.mockResolvedValue("nova-key-gerada");

    const res = await request(app)
      .post("/v1/auth/regenerate-key")
      .set("Authorization", "Bearer token-valido");

    expect(res.status).toBe(200);
    expect(res.body.api_key).toBe("nova-key-gerada");
  });
});
