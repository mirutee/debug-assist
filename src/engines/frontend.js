// src/engines/frontend.js
function diagnosticarFrontend({ tipo, mensagem = "", status, dados = {} }) {
  const base = { categoria: "frontend", confianca: 0.85 };

  if (tipo === "hydration_error") {
    const stack = String(dados.stack || "");
    const htmlServer = dados.html_server;
    const htmlClient = dados.html_client;
    let causa = "Diferença entre renderização no servidor (SSR) e no cliente";
    let confianca = 0.85;
    const sugestoes = [
      "Evitar uso de Date.now(), Math.random() ou window no render",
      "Utilizar useEffect para dados que mudam apenas no cliente",
      "Garantir que dados do servidor e do cliente sejam consistentes",
    ];

    if (stack.includes("Date.now") || mensagem.includes("Date.now")) {
      causa = "Date.now() chamado durante o render — produz valor diferente no servidor e no cliente";
      confianca = 0.97;
    } else if (stack.includes("Math.random")) {
      causa = "Math.random() chamado durante o render — produz valor diferente em cada execução";
      confianca = 0.97;
    } else if (
      stack.includes("window.") ||
      stack.includes("localStorage") ||
      stack.includes("document.") ||
      stack.includes("window is not defined")
    ) {
      causa = "Acesso a API do browser (window/localStorage/document) durante SSR — não existe no servidor";
      confianca = 0.97;
      sugestoes.unshift("Mover acesso a window/localStorage/document para dentro de useEffect");
      sugestoes.unshift("Verificar com 'typeof window !== \"undefined\"' antes de acessar APIs do browser");
    } else if (htmlServer && htmlClient && htmlServer !== htmlClient) {
      causa = "Conteúdo HTML do servidor difere do cliente — dado dinâmico renderizado no SSR com valor inconsistente";
      confianca = 0.92;
    }

    return {
      ...base,
      problema: "Erro de hidratação",
      causa,
      nivel: "alto",
      sugestoes,
      confianca,
    };
  }

  if (tipo === "request_error") {
    const msg = mensagem.toLowerCase();

    // CORS — detectado pelo conteúdo da mensagem, independe do status
    if (msg.includes("cors") || msg.includes("access-control") || msg.includes("has been blocked by cors")) {
      return {
        ...base,
        problema: "Erro de CORS",
        causa: "Requisição bloqueada pela política CORS do servidor — o origin não está autorizado",
        nivel: "alto",
        sugestoes: [
          "Adicionar o header 'Access-Control-Allow-Origin' no servidor",
          "Verificar se o endpoint aceita requisições do origin atual",
          "Em desenvolvimento, usar um proxy ou configurar CORS no backend",
        ],
        confianca: 0.97,
      };
    }

    if (status === 401) {
      const headers = dados.headers || {};
      const temAuth = Object.keys(headers).some(
        (k) => k.toLowerCase() === "authorization"
      );
      if (!temAuth) {
        return {
          ...base,
          problema: "Falha de autenticação na requisição",
          causa: "Header Authorization ausente — a requisição foi enviada sem credenciais",
          nivel: "alto",
          sugestoes: [
            "Adicionar o header 'Authorization: Bearer {token}' na requisição",
            "Verificar se o token está sendo lido corretamente do storage",
            "Checar se o fluxo de login está salvando o token antes da chamada",
          ],
          confianca: 0.95,
        };
      }
      return {
        ...base,
        problema: "Falha de autenticação na requisição",
        causa: "Token ausente, inválido ou expirado",
        nivel: "alto",
        sugestoes: [
          "Verificar se o header Authorization está presente",
          "Checar validade e expiração do token",
          "Renovar o token de acesso",
        ],
      };
    }
    if (status === 403) {
      return {
        ...base,
        problema: "Acesso negado",
        causa: "Usuário autenticado mas sem permissão",
        nivel: "médio",
        sugestoes: [
          "Verificar permissões do usuário",
          "Checar políticas de acesso no backend",
        ],
      };
    }
    if (status === 404) {
      return {
        ...base,
        problema: "Endpoint não encontrado",
        causa: "URL incorreta ou recurso removido",
        nivel: "médio",
        sugestoes: [
          "Verificar se a URL está correta",
          "Confirmar se o endpoint ainda existe no backend",
        ],
      };
    }
    if (status >= 500) {
      return {
        ...base,
        problema: "Erro interno no servidor",
        causa: "O backend retornou um erro não tratado",
        nivel: "alto",
        sugestoes: [
          "Verificar logs do servidor",
          "Checar se a resposta é JSON válido",
          "Adicionar tratamento de erro no frontend para status 5xx",
        ],
      };
    }
    return {
      ...base,
      problema: "Requisição falhou",
      causa: `Status HTTP ${status || "desconhecido"}`,
      nivel: "médio",
      sugestoes: ["Verificar resposta da API", "Adicionar tratamento de erro adequado"],
    };
  }

  if (tipo === "silent_error") {
    const msg = mensagem;
    let causa = "Erro capturado mas não tratado ou exibido";
    let confianca = 0.85;
    const sugestoes = [
      "Adicionar .catch() em todas as Promises",
      "Nunca deixar bloco catch vazio",
      "Logar erros e notificar o usuário quando apropriado",
    ];

    if (msg.includes("TypeError") || msg.includes("Cannot read propert")) {
      causa = "TypeError: acesso a propriedade de valor null ou undefined — dado não inicializado antes do uso";
      confianca = 0.95;
      sugestoes.unshift("Verificar se o dado existe antes de acessar propriedades: if (data && data.prop)");
    } else if (msg.includes("ReferenceError") || msg.includes("is not defined")) {
      causa = "ReferenceError: variável ou módulo referenciado antes de ser declarado ou importado";
      confianca = 0.95;
      sugestoes.unshift("Verificar imports e a ordem de declaração das variáveis");
    } else if (msg.includes("SyntaxError")) {
      causa = "SyntaxError: JSON inválido ou código com erro de sintaxe sendo avaliado dinamicamente";
      confianca = 0.93;
    }

    return {
      ...base,
      problema: "Erro silencioso detectado",
      causa,
      nivel: "médio",
      sugestoes,
      confianca,
    };
  }

  if (tipo === "responsive_error") {
    const tipoProblema = dados.problema || "layout";
    if (tipoProblema === "overflow") {
      return {
        ...base,
        problema: "Layout quebrado — overflow horizontal",
        causa: `Conteúdo ultrapassa a largura da tela (${dados.largura || "?"}px)`,
        nivel: "médio",
        sugestoes: [
          "Usar unidades relativas (%, vw) em vez de px fixo",
          "Adicionar overflow-x: hidden no container pai",
          "Revisar media queries para telas pequenas",
        ],
      };
    }
    return {
      ...base,
      problema: "Problema de layout responsivo",
      causa: "Elemento não se adapta corretamente à resolução do usuário",
      nivel: "médio",
      sugestoes: [
        "Testar em múltiplas resoluções (375px, 768px, 1024px)",
        "Usar Flexbox ou Grid para layouts adaptativos",
        "Revisar uso de posicionamento absoluto",
      ],
    };
  }

  if (tipo === "performance_issue") {
    const tempo = dados.tempo_execucao || 0;
    return {
      ...base,
      problema: "Problema de performance no frontend",
      causa: tempo > 100 ? `Tarefa demorou ${tempo}ms (acima de 100ms bloqueia a UI)` : "Render ou interação lenta",
      nivel: tempo > 200 ? "alto" : "médio",
      sugestoes: [
        "Usar React.memo() ou useMemo para evitar re-renders desnecessários",
        "Evitar loops pesados na thread principal",
        "Mover processamento para Web Workers se necessário",
      ],
    };
  }

  return {
    ...base,
    problema: "Problema de frontend não classificado",
    causa: mensagem || "Informações insuficientes para diagnóstico preciso",
    nivel: "baixo",
    sugestoes: ["Enviar mais contexto (status, dados) para diagnóstico detalhado"],
    confianca: 0.4,
  };
}

module.exports = diagnosticarFrontend;
