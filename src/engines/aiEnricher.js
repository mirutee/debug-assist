// src/engines/aiEnricher.js
const { decrypt } = require('../utils/encrypt');

const TIMEOUT_MS = 5000;
const SUPPORTED_PROVIDERS = ['openai', 'anthropic', 'groq'];

function resolveAiConfig(usuario, headers) {
  // SEGURANÇA: NÃO aceitar chaves de IA em headers (X-Forwarded-For, proxies, logs podem expor)
  // Apenas usar chaves salvas no banco (encriptadas)
  const headerKey = headers['x-ai-key'];
  if (headerKey) {
    console.warn('[aiEnricher] AVISO: Tentativa de enviar AI key em headers (inseguro)');
    // Ignorar silenciosamente - não é mais suportado
  }

  if (usuario.ai_key_encrypted && usuario.ai_provider) {
    if (!SUPPORTED_PROVIDERS.includes(usuario.ai_provider)) return null;
    try {
      return { key: decrypt(usuario.ai_key_encrypted), provider: usuario.ai_provider };
    } catch (err) {
      console.error('[aiEnricher] Erro ao descriptografar chave de IA:', err.message);
      return null;
    }
  }
  return null;
}

function buildPrompt(resultado, payload) {
  return `Você é um especialista em diagnóstico de sistemas de software.
O sistema já detectou o seguinte problema via análise automática:

Problema: ${resultado.problema}
Causa: ${resultado.causa}
Nível: ${resultado.nivel}
Sugestões detectadas: ${(resultado.sugestoes || []).join('; ')}

Contexto original enviado:
${JSON.stringify(payload, null, 2)}

Forneça uma análise aprofundada da causa raiz em 2-4 parágrafos, explicando por que esse problema ocorre, quais são os riscos reais e como corrigi-lo de forma definitiva. Seja técnico e direto. Responda em português.`;
}

async function callAI({ key, provider }, prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let response;
    if (provider === 'anthropic') {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      return data.content?.[0]?.text || null;
    } else {
      // openai e groq usam API compatible
      const baseUrl = provider === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
      const model = provider === 'groq' ? 'llama3-8b-8192' : 'gpt-4o-mini';
      response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    }
  } finally {
    clearTimeout(timer);
  }
}

async function aiEnricher(resultado, payload, usuario, headers) {
  const config = resolveAiConfig(usuario, headers);

  if (!config) {
    return {
      ...resultado,
      analise_aprofundada: null,
      ia_aviso: 'Configure uma API key de IA nas configurações para ativar a análise aprofundada.',
    };
  }

  try {
    const prompt = buildPrompt(resultado, payload);
    const analise = await callAI(config, prompt);
    return {
      ...resultado,
      analise_aprofundada: analise,
      ia_provider: config.provider,
      ia_timeout: false,
    };
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    return {
      ...resultado,
      analise_aprofundada: null,
      ia_provider: config.provider,
      ia_timeout: isTimeout,
    };
  }
}

module.exports = aiEnricher;
