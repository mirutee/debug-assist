// tests/engines/aiEnricher.test.js

// decrypt como passthrough — a chave armazenada é retornada sem modificação
jest.mock('../../src/utils/encrypt', () => ({
  decrypt: jest.fn(val => val),
  encrypt: jest.fn(val => val),
}));

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
const usuarioOpenai = { ai_key_encrypted: 'sk-openai', ai_provider: 'openai' };
const usuarioAnthropic = { ai_key_encrypted: 'sk-ant', ai_provider: 'anthropic' };

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

  it('x-ai-key header é ignorado (removido por segurança)', async () => {
    global.fetch = jest.fn();
    const headers = { 'x-ai-key': 'sk-header', 'x-ai-provider': 'openai' };
    const r = await aiEnricher(baseResultado, basePayload, usuarioSemKey, headers);
    // Header ignorado — sem key no usuario, deve retornar ia_aviso sem chamar IA
    expect(global.fetch).not.toHaveBeenCalled();
    expect(r.ia_aviso).toBeDefined();
    expect(r.analise_aprofundada).toBeNull();
  });

  it('openai: retorna analise_aprofundada no sucesso', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        choices: [{ message: { content: 'Análise detalhada OpenAI' } }],
      }),
    });

    const r = await aiEnricher(baseResultado, basePayload, usuarioOpenai, {});

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

    const r = await aiEnricher(baseResultado, basePayload, usuarioAnthropic, {});

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

    const r = await aiEnricher(baseResultado, basePayload, usuarioOpenai, {});

    expect(r.analise_aprofundada).toBeNull();
    expect(r.ia_timeout).toBe(true);
    expect(r.problema).toBe(baseResultado.problema);
  });

  it('erro genérico da IA: retorna ia_timeout: false e analise null', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

    const r = await aiEnricher(baseResultado, basePayload, usuarioOpenai, {});

    expect(r.analise_aprofundada).toBeNull();
    expect(r.ia_timeout).toBe(false);
  });

  it('provider desconhecido: retorna ia_aviso sem chamar IA', async () => {
    global.fetch = jest.fn();
    const usuarioGemini = { ai_key_encrypted: 'sk-test', ai_provider: 'gemini' };
    const r = await aiEnricher(baseResultado, basePayload, usuarioGemini, {});
    expect(global.fetch).not.toHaveBeenCalled();
    expect(r.ia_aviso).toBeDefined();
    expect(r.analise_aprofundada).toBeNull();
  });
});
