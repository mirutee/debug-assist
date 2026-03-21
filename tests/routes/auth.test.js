// tests/routes/auth.test.js
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => mockSupabase),
}));

const mockSupabase = {
  from: jest.fn(),
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    getUser: jest.fn(),
  },
  rpc: jest.fn(),
};

// Also mock src/db/supabase for the auth middleware used in diagnosticos
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

beforeEach(() => jest.clearAllMocks());

const request = require("supertest");
const app = require("../../src/app");

describe("POST /v1/auth/signup", () => {
  it("retorna 201 para signup válido", async () => {
    mockSupabase.auth.signUp.mockResolvedValue({ data: {}, error: null });

    const res = await request(app)
      .post("/v1/auth/signup")
      .send({ email: "user@gmail.com", senha: "senha123" });

    expect(res.status).toBe(201);
    expect(res.body.mensagem).toMatch(/verifique/i);
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
    mockSupabase.auth.signUp.mockResolvedValue({
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
});

describe("POST /v1/auth/login", () => {
  it("retorna 200 com token para login válido", async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
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
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
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
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
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
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-uuid" } },
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              email: "user@gmail.com",
              api_key: "key-uuid",
              plano_id: "free",
              uso_mensal: 10,
              planos: { limite_mensal: 100 },
            },
            error: null,
          }),
        }),
      }),
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
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid token" },
    });

    const res = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", "Bearer jwt-invalido");

    expect(res.status).toBe(401);
  });

  it("retorna 404 quando usuário não confirmou email", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-uuid" } },
      error: null,
    });

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const res = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", "Bearer jwt-valido");

    expect(res.status).toBe(404);
    expect(res.body.erro).toMatch(/confirme/i);
  });
});
