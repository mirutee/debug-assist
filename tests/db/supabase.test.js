// tests/db/supabase.test.js
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_KEY = 'test-key';

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));


const mockSupabaseClient = {
  from: jest.fn(),
  auth: { getUser: jest.fn() },
  rpc: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

const { getUsuarioByApiKey, incrementarUso, getUsuarioByAuthId, getUsuarioById, updatePlanoBilling, getUsuarioByStripeCustomerId } =
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

// --- billing functions ---

describe("getUsuarioById", () => {
  it("retorna null quando usuário não encontrado", async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
        }),
      }),
    });

    const result = await getUsuarioById("uuid-inexistente");
    expect(result).toBeNull();
  });
});

describe("updatePlanoBilling", () => {
  it("lança erro quando Supabase retorna erro", async () => {
    mockSupabaseClient.from.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: { message: "db error" } }),
      }),
    });

    await expect(
      updatePlanoBilling("user-uuid", { plano_id: "pro" })
    ).rejects.toThrow("db error");
  });

  it("retorna sem chamar update quando ambos os campos são undefined", async () => {
    await updatePlanoBilling("user-uuid", {});

    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });
});

describe("getUsuarioByStripeCustomerId", () => {
  it("retorna null quando customer não encontrado", async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
        }),
      }),
    });

    const result = await getUsuarioByStripeCustomerId("cus_inexistente");
    expect(result).toBeNull();
  });
});

describe("getDiagnosticosByUsuario", () => {
  it("retorna diagnósticos do usuário sem filtro after", async () => {
    const fakeDiagnosticos = [
      { id: "d1", tipo: "silent_backend_error", criado_em: "2026-03-23T10:00:00Z", resposta: {}, mensagem: "err", contexto: {} },
    ];

    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: fakeDiagnosticos, error: null }),
          }),
        }),
      }),
    });

    const { getDiagnosticosByUsuario } = require("../../src/db/supabase");
    const result = await getDiagnosticosByUsuario("user-uuid");
    expect(result).toEqual(fakeDiagnosticos);
  });

  it("aplica filtro gt quando after é fornecido", async () => {
    // When `after` is provided, getDiagnosticosByUsuario calls query.gt("criado_em", after)
    // The Supabase chain is: from → select → eq → order → limit → gt (when after present)
    const mockGt = jest.fn().mockResolvedValue({ data: [], error: null });
    const mockLimitWithAfter = jest.fn().mockReturnValue({ gt: mockGt });
    const mockOrderWithAfter = jest.fn().mockReturnValue({ limit: mockLimitWithAfter });
    const mockEqWithAfter = jest.fn().mockReturnValue({ order: mockOrderWithAfter });
    const mockSelectWithAfter = jest.fn().mockReturnValue({ eq: mockEqWithAfter });
    mockSupabaseClient.from.mockReturnValue({ select: mockSelectWithAfter });

    const { getDiagnosticosByUsuario } = require("../../src/db/supabase");
    await getDiagnosticosByUsuario("user-uuid", { after: "2026-03-23T10:00:00Z" });
    expect(mockGt).toHaveBeenCalledWith("criado_em", "2026-03-23T10:00:00Z");
  });

  it("lança erro quando Supabase retorna erro", async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: null, error: { message: "db error" } }),
          }),
        }),
      }),
    });

    const { getDiagnosticosByUsuario } = require("../../src/db/supabase");
    await expect(getDiagnosticosByUsuario("user-uuid")).rejects.toThrow();
  });
});

describe("saveDiagnostico com usuario_id", () => {
  it("passa usuario_id para o insert", async () => {
    const mockInsert = jest.fn().mockResolvedValue({ error: null });
    mockSupabaseClient.from.mockReturnValue({ insert: mockInsert });

    const { saveDiagnostico } = require("../../src/db/supabase");
    await saveDiagnostico({ tipo: "silent_backend_error", mensagem: "err", contexto: {}, resposta: {}, usuario_id: "user-uuid" });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ usuario_id: "user-uuid" })
    );
  });
});

const { regenerateApiKey, getAnalyticsByUsuario } = require("../../src/db/supabase");

describe("regenerateApiKey", () => {
  it("retorna a nova api_key após update bem-sucedido", async () => {
    mockSupabaseClient.from.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { api_key: "nova-key-uuid" },
              error: null,
            }),
          }),
        }),
      }),
    });

    const result = await regenerateApiKey("user-uuid");
    expect(result).toBe("nova-key-uuid");
  });

  it("lança erro se update falhar", async () => {
    mockSupabaseClient.from.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: "update failed" },
            }),
          }),
        }),
      }),
    });

    await expect(regenerateApiKey("user-uuid")).rejects.toThrow("update failed");
  });
});

describe("getAnalyticsByUsuario", () => {
  it("retorna dados agrupados por data", async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({
            data: [
              { criado_em: "2026-03-01T10:00:00Z" },
              { criado_em: "2026-03-01T12:00:00Z" },
              { criado_em: "2026-03-02T09:00:00Z" },
            ],
            error: null,
          }),
        }),
      }),
    });

    const result = await getAnalyticsByUsuario("user-uuid");
    expect(result).toEqual([
      { data: "2026-03-01", total: 2 },
      { data: "2026-03-02", total: 1 },
    ]);
  });

  it("retorna array vazio se não houver diagnósticos", async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const result = await getAnalyticsByUsuario("user-uuid");
    expect(result).toEqual([]);
  });

  it("lança erro se query falhar", async () => {
    mockSupabaseClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          gte: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "query failed" },
          }),
        }),
      }),
    });

    await expect(getAnalyticsByUsuario("user-uuid")).rejects.toThrow("query failed");
  });
});
