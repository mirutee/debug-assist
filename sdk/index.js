// sdk/index.js
const DEFAULT_BASE_URL = 'https://devinsight-api.onrender.com';

class DevInsight {
  constructor({ apiKey, baseUrl } = {}) {
    if (!apiKey) throw new Error('DevInsight: apiKey é obrigatória');
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || DEFAULT_BASE_URL;
  }

  async report({ tipo, mensagem, contexto, dados } = {}) {
    if (!tipo) throw new Error("DevInsight: campo 'tipo' é obrigatório");

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
      throw new Error(`DevInsight API error ${response.status}: ${err.erro || 'desconhecido'}`);
    }

    return response.json();
  }

  static init({ apiKey, projectName = 'unknown', baseUrl } = {}) {
    if (DevInsight._initialized) return;

    const client = new DevInsight({ apiKey, baseUrl });
    DevInsight._initialized = true;

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

DevInsight._initialized = false;

module.exports = DevInsight;
