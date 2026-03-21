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
}

module.exports = DevInsight;
