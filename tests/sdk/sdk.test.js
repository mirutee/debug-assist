// tests/sdk/sdk.test.js
// Tests only SDK validation logic — does NOT make real HTTP calls
const { reportError } = require("../../sdk/index");

describe("SDK reportError", () => {
  it("lança erro quando apiKey não fornecida", async () => {
    await expect(
      reportError({ tipo: "hydration_error", mensagem: "x" }, undefined)
    ).rejects.toThrow("apiKey é obrigatória");
  });

  it("lança erro quando tipo não fornecido", async () => {
    await expect(
      reportError({ mensagem: "x" }, "minha-key")
    ).rejects.toThrow("'tipo' é obrigatório");
  });

  it("chama fetch com os dados corretos", async () => {
    const mockResponse = { ok: true, json: async () => ({ problema: "ok" }) };
    global.fetch = jest.fn().mockResolvedValue(mockResponse);

    const result = await reportError(
      { tipo: "hydration_error", mensagem: "teste" },
      "minha-api-key"
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/diagnosticos"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer minha-api-key" }),
      })
    );
    expect(result.problema).toBe("ok");

    delete global.fetch;
  });
});
