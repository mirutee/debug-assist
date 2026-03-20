// src/db/supabase.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function saveDiagnostico({ tipo, mensagem, contexto, resposta }) {
  const { error } = await supabase
    .from("diagnosticos")
    .insert({ tipo, mensagem, contexto, resposta });

  if (error) {
    console.error("Erro ao salvar diagnóstico no Supabase:", error.message);
  }
}

module.exports = { saveDiagnostico };
