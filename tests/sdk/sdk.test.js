// tests/sdk/sdk.test.js
const DevInsight = require('../../sdk/index');

describe('DevInsight SDK', () => {
  afterEach(() => {
    delete global.fetch;
  });

  it('lança erro síncrono quando apiKey ausente', () => {
    expect(() => new DevInsight({})).toThrow('DebugAssist: apiKey é obrigatória');
  });

  it('lança erro síncrono quando tipo ausente em report()', async () => {
    const client = new DevInsight({ apiKey: 'test-key' });
    await expect(client.report({})).rejects.toThrow("DebugAssist: campo 'tipo' é obrigatório");
  });

  it('chama fetch com URL, método, header e body corretos', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ problema: 'ok', causa: 'x', nivel: 'baixo', sugestoes: [], confianca: 0.9 }),
    });
    const client = new DevInsight({ apiKey: 'minha-key' });
    await client.report({ tipo: 'backend', mensagem: 'erro' });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://debug-assist.onrender.com/v1/diagnosticos',
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
      .rejects.toThrow('DebugAssist API error 401: API Key inválida');
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

describe("DevInsight.init() auto-capture", () => {
  let originalListeners;

  beforeEach(() => {
    // Save and remove existing listeners to avoid interference
    originalListeners = {
      uncaughtException: process.listeners('uncaughtException').slice(),
      unhandledRejection: process.listeners('unhandledRejection').slice(),
    };
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');

    // Reset the initialized flag between tests
    DevInsight._initialized = false;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  afterEach(() => {
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    originalListeners.uncaughtException.forEach(l => process.on('uncaughtException', l));
    originalListeners.unhandledRejection.forEach(l => process.on('unhandledRejection', l));
    DevInsight._initialized = false;
  });

  it("registra listener de uncaughtException ao chamar init()", () => {
    DevInsight.init({ apiKey: 'test-key' });
    expect(process.listenerCount('uncaughtException')).toBe(1);
  });

  it("registra listener de unhandledRejection ao chamar init()", () => {
    DevInsight.init({ apiKey: 'test-key' });
    expect(process.listenerCount('unhandledRejection')).toBe(1);
  });

  it("não registra listeners duplicados se init() chamado duas vezes", () => {
    DevInsight.init({ apiKey: 'test-key' });
    DevInsight.init({ apiKey: 'test-key' });
    expect(process.listenerCount('uncaughtException')).toBe(1);
    expect(process.listenerCount('unhandledRejection')).toBe(1);
  });

  it("envia diagnóstico silent_backend_error ao capturar uncaughtException", async () => {
    DevInsight.init({ apiKey: 'test-key', projectName: 'meu-projeto' });

    const err = new Error('test crash');
    // Emit uncaughtException but prevent actual process exit
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    process.emit('uncaughtException', err);

    // Wait for async send
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/diagnosticos'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      })
    );
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.tipo).toBe('silent_backend_error');
    expect(body.mensagem).toBe('test crash');
    expect(body.contexto.projectName).toBe('meu-projeto');

    mockExit.mockRestore();
  });

  it("não lança erro se o envio do diagnóstico falhar", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
    DevInsight.init({ apiKey: 'test-key' });

    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    expect(() => process.emit('uncaughtException', new Error('crash'))).not.toThrow();

    await new Promise(resolve => setTimeout(resolve, 50));
    mockExit.mockRestore();
  });
});
