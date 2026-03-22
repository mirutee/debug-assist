// src/engines/sql.js
function diagnosticarSQL({ mensagem = "", dados = {} }) {
  const base = { categoria: "sql", confianca: 0.9 };
  const query = (dados.query || "").toUpperCase();
  const tempo = dados.tempo_execucao || 0;
  const execucoes = dados.quantidade_execucoes || 1;
  const sugestoes = [];
  const problemas = [];
  let nivel = "baixo";
  let confianca = 0.9;

  // SQL Injection — highest priority, return early
  if (query.includes("' +") || query.includes("\" +") || query.includes("+ '") || query.includes("CONCAT(")) {
    return {
      ...base,
      problema: "Risco de SQL Injection detectado",
      causa: "Query construída com concatenação de strings — vetor de ataque",
      nivel: "alto",
      sugestoes: [
        "Usar prepared statements / queries parametrizadas",
        "Nunca concatenar input do usuário diretamente na query",
        "Usar ORM como Prisma ou Sequelize",
      ],
      confianca: 0.95,
    };
  }

  // N+1 — return early
  if (execucoes >= 10) {
    return {
      ...base,
      problema: "N+1 Query detectado",
      causa: `Query executada ${execucoes} vezes — padrão N+1 identificado`,
      nivel: "alto",
      sugestoes: [
        "Usar JOIN para buscar dados relacionados em uma única query",
        "Carregar dados em lote (batch loading)",
        "Usar eager loading no ORM",
      ],
      confianca: 0.9,
    };
  }

  // DELETE/UPDATE sem WHERE — retorno antecipado, risco de destruição de dados
  if (
    (query.startsWith("DELETE") || query.startsWith("UPDATE")) &&
    !query.includes("WHERE")
  ) {
    return {
      ...base,
      problema: "DELETE/UPDATE sem cláusula WHERE detectado",
      causa: "Query pode afetar ou apagar TODOS os registros da tabela",
      nivel: "alto",
      sugestoes: [
        "Sempre incluir WHERE em DELETE e UPDATE",
        "Testar a cláusula WHERE com SELECT antes de executar",
        "Usar transação para poder fazer rollback se necessário",
      ],
      confianca: 0.98,
    };
  }

  // Slow query
  if (tempo > 500) {
    problemas.push("Query lenta");
    nivel = "alto";
    sugestoes.push(`Tempo de execução: ${tempo}ms — otimizar é urgente`);
    sugestoes.push("Verificar índices nas colunas do WHERE");
    sugestoes.push("Analisar EXPLAIN ANALYZE da query");
  }

  // SELECT *
  if (query.includes("SELECT *")) {
    problemas.push("SELECT * detectado");
    if (nivel === "baixo") nivel = "médio";
    sugestoes.push("Selecionar apenas as colunas necessárias");
    sugestoes.push("Reduz tráfego de rede e uso de memória");
  }

  // No LIMIT
  if (query.includes("SELECT") && !query.includes("LIMIT")) {
    if (query.includes("ORDER BY")) {
      sugestoes.push("ORDER BY sem LIMIT pode ser muito custoso — adicione LIMIT para paginar resultados");
    } else {
      sugestoes.push("Adicionar LIMIT para evitar retorno de grandes volumes de dados");
    }
  }

  // LIKE com wildcard à esquerda — impede uso de índice
  if (query.includes("LIKE '%") || query.includes('LIKE "%')) {
    if (nivel === "baixo") nivel = "médio";
    sugestoes.push("LIKE com '%' à esquerda não usa índice — considere Full Text Search");
    sugestoes.push("Se a busca for comum, avalie pg_trgm ou índice GIN no PostgreSQL");
    problemas.push("LIKE com wildcard à esquerda");
  }

  if (problemas.length === 0) {
    return {
      ...base,
      problema: "Nenhum problema crítico detectado",
      causa: "Query dentro dos parâmetros aceitáveis",
      nivel: "baixo",
      sugestoes: sugestoes.length > 0 ? sugestoes : ["Query parece saudável"],
      confianca: 0.8,
    };
  }

  return {
    ...base,
    problema: problemas.join(" + "),
    causa: mensagem || "Padrões problemáticos identificados na query",
    nivel,
    sugestoes,
    confianca,
  };
}

module.exports = diagnosticarSQL;
