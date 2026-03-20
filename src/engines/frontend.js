// src/engines/frontend.js
function diagnosticarFrontend({ tipo, mensagem = "", status, dados = {} }) {
  const base = { categoria: "frontend", confianca: 0.85 };

  if (tipo === "hydration_error") {
    return {
      ...base,
      problema: "Erro de hidratação",
      causa: "Diferença entre renderização no servidor (SSR) e no cliente",
      nivel: "alto",
      sugestoes: [
        "Evitar uso de Date.now(), Math.random() ou window no render",
        "Utilizar useEffect para dados que mudam apenas no cliente",
        "Garantir que dados do servidor e do cliente sejam consistentes",
      ],
    };
  }

  if (tipo === "request_error") {
    if (status === 401) {
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
    return {
      ...base,
      problema: "Erro silencioso detectado",
      causa: "Erro capturado mas não tratado ou exibido",
      nivel: "médio",
      sugestoes: [
        "Adicionar .catch() em todas as Promises",
        "Nunca deixar bloco catch vazio",
        "Logar erros e notificar o usuário quando apropriado",
      ],
    };
  }

  if (tipo === "responsive_error") {
    const tipoProbema = dados.problema || "layout";
    if (tipoProbema === "overflow") {
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
