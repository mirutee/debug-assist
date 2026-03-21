// tests/sdk/sdk.test.js
const DevInsight = require('../../sdk/index');

describe('DevInsight SDK', () => {
  afterEach(() => {
    delete global.fetch;
  });

  it('lança erro síncrono quando apiKey ausente', () => {
    expect(() => new DevInsight({})).toThrow('DevInsight: apiKey é obrigatória');
  });

  it('lança erro síncrono quando tipo ausente em report()', async () => {
    const client = new DevInsight({ apiKey: 'test-key' });
    await expect(client.report({})).rejects.toThrow("DevInsight: campo 'tipo' é obrigatório");
  });

  it('chama fetch com URL, método, header e body corretos', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ problema: 'ok', causa: 'x', nivel: 'baixo', sugestoes: [], confianca: 0.9 }),
    });
    const client = new DevInsight({ apiKey: 'minha-key' });
    await client.report({ tipo: 'backend', mensagem: 'erro' });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://devinsight-api.onrender.com/v1/diagnosticos',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer minha-key',
        }),
        body: JSON.stringify({ tipo: 'backend', mensagem: 'erro', contexto: undefined, dados: undefined }),
      })
    );
  });

  it('retorna o objeto de diagnóstico completo em caso de sucesso', async () => {
    const mockDiagnosis = {
      problema: 'N+1 query detectada',
      causa: 'Loop sem eager loading',
      nivel: 'alto',
      categoria: 'sql',
      sugestoes: ['Use include/join'],
      confianca: 0.95,
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockDiagnosis,
    });
    const client = new DevInsight({ apiKey: 'test-key' });
    const result = await client.report({ tipo: 'sql', mensagem: 'query lenta' });

    expect(result).toEqual(mockDiagnosis);
  });

  it('lança erro com status e mensagem quando API retorna HTTP não-OK', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ erro: 'API Key inválida' }),
    });
    const client = new DevInsight({ apiKey: 'key-invalida' });
    await expect(client.report({ tipo: 'backend', mensagem: 'teste' }))
      .rejects.toThrow('DevInsight API error 401: API Key inválida');
  });

  it('usa baseUrl customizada fornecida no construtor', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ problema: 'ok' }),
    });
    const client = new DevInsight({ apiKey: 'test-key', baseUrl: 'http://localhost:3000' });
    await client.report({ tipo: 'frontend', mensagem: 'hydration error' });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/diagnosticos',
      expect.anything()
    );
  });
});
