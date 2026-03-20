// sdk/index.js
const API_URL = "https://api.devinsight.com/v1/diagnosticos";

/**
 * Envia um erro para diagnóstico na DevInsight API.
 * @param {object} data - Payload do erro
 * @param {string} data.tipo - Tipo do erro (ex: "hydration_error")
 * @param {string} [data.mensagem] - Mensagem de erro original
 * @param {number} [data.status] - HTTP status (opcional)
 * @param {object} [data.contexto] - Informações adicionais (url, plataforma)
 * @param {object} [data.dados] - Dados técnicos (query SQL, largura de tela, etc.)
 * @param {string} apiKey - Sua API Key da DevInsight
 * @returns {Promise<object>} - Diagnóstico retornado
 */
async function reportError(data, apiKey) {
  if (!apiKey) throw new Error("DevInsight SDK: apiKey é obrigatória");
  if (!data.tipo) throw new Error("DevInsight SDK: campo 'tipo' é obrigatório");

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`DevInsight API error ${response.status}: ${err.erro || "desconhecido"}`);
  }

  return response.json();
}

module.exports = { reportError };
