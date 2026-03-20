// src/engines/index.js
const diagnosticarFrontend = require("./frontend");
const diagnosticarBackend = require("./backend");
const diagnosticarSQL = require("./sql");

const TIPOS_FRONTEND = ["hydration_error", "request_error", "silent_error", "responsive_error", "performance_issue"];
const TIPOS_BACKEND = ["silent_backend_error", "contract_error", "external_api_error"];
const TIPOS_SQL = ["sql_analysis"];

function diagnosticar(payload) {
  const { tipo } = payload;

  if (TIPOS_FRONTEND.includes(tipo)) return diagnosticarFrontend(payload);
  if (TIPOS_BACKEND.includes(tipo)) return diagnosticarBackend(payload);
  if (TIPOS_SQL.includes(tipo)) return diagnosticarSQL(payload);

  return {
    categoria: "desconhecido",
    problema: "Tipo de diagnóstico não reconhecido",
    causa: `Tipo '${tipo}' não é suportado`,
    nivel: "baixo",
    sugestoes: [
      "Tipos suportados: hydration_error, request_error, silent_error, responsive_error, performance_issue, silent_backend_error, contract_error, external_api_error, sql_analysis",
    ],
    confianca: 0,
  };
}

module.exports = diagnosticar;
