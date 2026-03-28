// tests/engines/aiEnricher.test.js
const aiEnricher = require('../../src/engines/aiEnricher');

const baseResultado = {
  problema: 'Erro de hidratação',
  causa: 'Date.now() no render',
  nivel: 'alto',
  categoria: 'frontend',
  confianca: 0.97,
  sugestoes: ['Sugestão 1', 'Sugestão 2'],
};

const basePayload = { tipo: 'hydration_error', mensagem: 'Hydration failed' };

const usuarioSemKey = { ai_key_encrypted: null, ai_provider: null };

describe('aiEnricher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sem key: retorna resultado com ia_aviso', async () => {
    const r = await aiEnricher(baseResultado, basePayload, usuarioSemKey, {});
    expect(r.analise_aprofundada).toBeNull();
    expect(r.ia_aviso).toBeDefined();
    expect(r.problema).toBe(baseResultado.problema);
  });

  it('header override tem prioridade sobre ai_key_encrypted', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        choices: [{ message: { content: 'Análise via header' } }],
      }),
    });

    const headers = { 'x-ai-key': 'sk-header', 'x-ai-provider': 'openai' };
    const r = await aiEnricher(baseResultado, basePayload, usuarioSemKey, headers);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(r.analise_aprofundada).toBe('Análise via header');
    expect(r.ia_provider).toBe('openai');
    expect(r.ia_timeout).toBe(false);
  });

  it('openai: retorna analise_aprofundada no sucesso', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        choices: [{ message: { content: 'Análise detalhada OpenAI' } }],
      }),
    });

    const headers = { 'x-ai-key': 'sk-openai', 'x-ai-provider': 'openai' };
    const r = await aiEnricher(baseResultado, basePayload, usuarioSemKey, headers);

    expect(r.analise_aprofundada).toBe('Análise detalhada OpenAI');
    expect(r.ia_timeout).toBe(false);
    expect(r.ia_provider).toBe('openai');
  });

  it('anthropic: chama endpoint correto e retorna analise', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        content: [{ text: 'Análise detalhada Anthropic' }],
      }),
    });

    const headers = { 'x-ai-key': 'sk-ant', 'x-ai-provider': 'anthropic' };
    const r = await aiEnricher(baseResultado, basePayload, usuarioSemKey, headers);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('anthropic.com'),
      expect.any(Object)
    );
    expect(r.analise_aprofundada).toBe('Análise detalhada Anthropic');
  });

  it('timeout: retorna ia_timeout: true sem analise', async () => {
    global.fetch = jest.fn().mockImplementationOnce(() =>
      new Promise((_, reject) => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        setTimeout(() => reject(err), 10);
      })
    );

    const headers = { 'x-ai-key': 'sk-slow', 'x-ai-provider': 'openai' };
    const r = await aiEnricher(baseResultado, basePayload, usuarioSemKey, headers);

    expect(r.analise_aprofundada).toBeNull();
    expect(r.ia_timeout).toBe(true);
    expect(r.problema).toBe(baseResultado.problema);
  });

  it('erro genérico da IA: retorna ia_timeout: false e analise null', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

    const headers = { 'x-ai-key': 'sk-err', 'x-ai-provider': 'openai' };
    const r = await aiEnricher(baseResultado, basePayload, usuarioSemKey, headers);

    expect(r.analise_aprofundada).toBeNull();
    expect(r.ia_timeout).toBe(false);
  });
});
