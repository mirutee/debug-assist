// tests/db/supabase.test.js
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

const mockSupabaseClient = {
  from: jest.fn(),
  auth: { getUser: jest.fn() },
  rpc: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

const { getUsuarioByApiKey, incrementarUso, getUsuarioByAuthId } =
  require("../../src/db/supabase");

describe("getUsuarioByApiKey", () => {
  it("retorna usuário com dados do plano quando key válida", async () => {
    const fakeUser = {
      id: "user-uuid",
      api_key: "key-uuid",
      plano_id: "free",
      uso_mensal: 10,
      ativo: true,
      planos: { limite_mensal: 100 },
    };

    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: fakeUser, error: null }),
          }),
        }),
      }),
    });

    const result = await getUsuarioByApiKey("key-uuid");
    expect(result).toEqual(fakeUser);
  });

  it("retorna null quando key não encontrada", async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
          }),
        }),
      }),
    });

    const result = await getUsuarioByApiKey("key-invalida");
    expect(result).toBeNull();
  });
});

describe("incrementarUso", () => {
  it("chama rpc increment_uso_mensal com id correto", async () => {
    mockSupabaseClient.rpc.mockResolvedValue({ error: null });

    await incrementarUso("user-uuid");

    expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
      "increment_uso_mensal",
      { p_usuario_id: "user-uuid" }
    );
  });

  it("loga erro quando rpc falha", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockSupabaseClient.rpc.mockResolvedValue({ error: { message: "db down" } });

    await incrementarUso("user-uuid");

    expect(consoleSpy).toHaveBeenCalledWith(
      "Erro ao incrementar uso:",
      "db down"
    );
    consoleSpy.mockRestore();
  });
});

describe("getUsuarioByAuthId", () => {
  it("retorna usuário pelo auth_id", async () => {
    const fakeUser = {
      id: "user-uuid",
      email: "u@e.com",
      api_key: "key-uuid",
      plano_id: "free",
      uso_mensal: 5,
      planos: { limite_mensal: 100 },
    };

    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: fakeUser, error: null }),
        }),
      }),
    });

    const result = await getUsuarioByAuthId("auth-uuid");
    expect(result).toEqual(fakeUser);
  });

  it("retorna null quando auth_id não encontrado", async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
        }),
      }),
    });

    const result = await getUsuarioByAuthId("auth-uuid-invalido");
    expect(result).toBeNull();
  });
});
