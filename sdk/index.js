// sdk/index.js
const DEFAULT_BASE_URL = 'https://debug-assist.onrender.com';

class DebugAssist {
  constructor({ apiKey, baseUrl } = {}) {
    if (!apiKey) throw new Error('DebugAssist: apiKey é obrigatória');
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || DEFAULT_BASE_URL;
  }

  async report({ tipo, mensagem, contexto, dados } = {}) {
    if (!tipo) throw new Error("DebugAssist: campo 'tipo' é obrigatório");

    const response = await fetch(`${this.baseUrl}/v1/diagnosticos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ tipo, mensagem, contexto, dados }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`DebugAssist API error ${response.status}: ${err.erro || 'desconhecido'}`);
    }

    return response.json();
  }

  static init({ apiKey, projectName = 'unknown', baseUrl } = {}) {
    if (DebugAssist._initialized) return;

    const client = new DebugAssist({ apiKey, baseUrl });
    DebugAssist._initialized = true;

    async function sendSilently(err) {
      try {
        await client.report({
          tipo: 'silent_backend_error',
          mensagem: err && err.message ? err.message : String(err),
          contexto: { projectName, stack: err && err.stack ? err.stack : undefined },
        });
      } catch (_) {
        // Never throw — capturing errors must not cause new errors
      }
    }

    process.on('uncaughtException', async (err) => {
      await sendSilently(err);
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      await sendSilently(reason instanceof Error ? reason : new Error(String(reason)));
    });
  }
}

DebugAssist._initialized = false;

module.exports = DebugAssist;
