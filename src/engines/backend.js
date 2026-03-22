// src/engines/backend.js
function diagnosticarBackend({ tipo, mensagem = "", dados = {} }) {
  const base = { categoria: "backend", confianca: 0.85 };

  if (tipo === "silent_backend_error") {
    const msg = mensagem.toLowerCase();
    let causa = "Exceção capturada mas não tratada adequadamente";
    let confianca = 0.85;

    if (msg.includes("cannot read propert") || msg.includes("properties of null") || msg.includes("properties of undefined")) {
      causa = "Acesso a propriedade de objeto null ou undefined — verifique se o dado existe antes de acessá-lo";
      confianca = 0.95;
    } else if (msg.includes("is not a function")) {
      causa = "Método ou função não existe no objeto — verifique o tipo do dado antes de chamar o método";
      confianca = 0.95;
    } else if (msg.includes("is not defined")) {
      causa = "Variável ou módulo não declarado — verifique imports e escopo";
      confianca = 0.92;
    }

    return {
      ...base,
      problema: "Erro silencioso no backend",
      causa,
      nivel: "alto",
      sugestoes: [
        "Nunca deixar bloco catch vazio",
        "Logar stack trace completo do erro",
        "Retornar status HTTP adequado em vez de 200 com erro no body",
        "Implementar handler global de erros no Express",
      ],
      confianca,
    };
  }

  if (tipo === "contract_error") {
    const resposta = String(dados.resposta || "");
    let causa = "Resposta não corresponde ao schema esperado";
    let confianca = 0.85;

    if (resposta.trimStart().startsWith("<")) {
      causa = "API retornou HTML em vez de JSON — provavelmente uma página de erro do servidor";
      confianca = 0.95;
    }

    return {
      ...base,
      problema: "Violação de contrato de API",
      causa,
      nivel: "alto",
      sugestoes: [
        "Validar resposta com Zod ou Joi antes de retornar ao cliente",
        "Verificar se o status HTTP corresponde ao conteúdo retornado",
        "Garantir que erros 5xx retornem JSON e não HTML",
        "Documentar e respeitar o OpenAPI spec",
      ],
      confianca,
    };
  }

  if (tipo === "external_api_error") {
    const msg = mensagem.toLowerCase();
    const statusExterno = dados.status_externo;
    let causa = "Serviço externo indisponível ou com comportamento inesperado";
    let confianca = 0.85;
    const sugestoes = [
      "Adicionar timeout explícito nas chamadas externas",
      "Implementar fallback ou retry com backoff exponencial",
      "Tratar erros da API externa separadamente dos erros internos",
      "Monitorar disponibilidade do serviço externo",
    ];

    if (msg.includes("econnrefused")) {
      causa = "Conexão recusada — o serviço externo não está aceitando conexões (ECONNREFUSED)";
      confianca = 0.97;
    } else if (msg.includes("etimedout") || msg.includes("timeout")) {
      causa = "Timeout na chamada externa — o serviço não respondeu no tempo esperado";
      confianca = 0.95;
    } else if (statusExterno === 429 || msg.includes("429") || msg.includes("rate limit") || msg.includes("too many")) {
      causa = "Rate limit atingido — a API externa recusou a requisição por excesso de chamadas (429)";
      confianca = 0.97;
      sugestoes.unshift("Aguardar o período de reset antes de tentar novamente");
      sugestoes.unshift("Implementar retry com espera exponencial ao receber 429");
    } else if (statusExterno === 503 || msg.includes("503")) {
      causa = "Serviço externo temporariamente indisponível (503)";
      confianca = 0.95;
    }

    return {
      ...base,
      problema: "Falha em integração com API externa",
      causa,
      nivel: "médio",
      sugestoes,
      confianca,
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
