// src/engines/backend.js
function diagnosticarBackend({ tipo, mensagem = "", dados = {} }) {
  const base = { categoria: "backend", confianca: 0.85 };

  if (tipo === "silent_backend_error") {
    return {
      ...base,
      problema: "Erro silencioso no backend",
      causa: "Exceção capturada mas não tratada adequadamente",
      nivel: "alto",
      sugestoes: [
        "Nunca deixar bloco catch vazio",
        "Logar stack trace completo do erro",
        "Retornar status HTTP adequado em vez de 200 com erro no body",
        "Implementar handler global de erros no Express",
      ],
    };
  }

  if (tipo === "contract_error") {
    return {
      ...base,
      problema: "Violação de contrato de API",
      causa: "Resposta não corresponde ao schema esperado",
      nivel: "alto",
      sugestoes: [
        "Validar resposta com Zod ou Joi antes de retornar ao cliente",
        "Verificar se o status HTTP corresponde ao conteúdo retornado",
        "Garantir que erros 5xx retornem JSON e não HTML",
        "Documentar e respeitar o OpenAPI spec",
      ],
    };
  }

  if (tipo === "external_api_error") {
    return {
      ...base,
      problema: "Falha em integração com API externa",
      causa: "Serviço externo indisponível ou com comportamento inesperado",
      nivel: "médio",
      sugestoes: [
        "Adicionar timeout explícito nas chamadas externas",
        "Implementar fallback ou retry com backoff exponencial",
        "Tratar erros da API externa separadamente dos erros internos",
        "Monitorar disponibilidade do serviço externo",
      ],
    };
  }

  return {
    ...base,
    problema: "Problema de backend não classificado",
    causa: mensagem || "Informações insuficientes",
    nivel: "baixo",
    sugestoes: ["Enviar mais contexto para diagnóstico detalhado"],
    confianca: 0.4,
  };
}

module.exports = diagnosticarBackend;
