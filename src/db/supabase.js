// src/db/supabase.js
const { createClient } = require("@supabase/supabase-js");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.warn("[DevInsight] AVISO: SUPABASE_URL ou SUPABASE_KEY não configurados — diagnósticos não serão persistidos.");
}

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_KEY || ""
);

async function saveDiagnostico({ tipo, mensagem, contexto, resposta }) {
  const { error } = await supabase
    .from("diagnosticos")
    .insert({ tipo, mensagem, contexto, resposta });

  if (error) {
    console.error("Erro ao salvar diagnóstico no Supabase:", error.message);
  }
}

async function getUsuarioByApiKey(apiKey) {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*, planos(limite_mensal)")
    .eq("api_key", apiKey)
    .eq("ativo", true)
    .single();

  if (error || !data) return null;
  return data;
}

async function incrementarUso(usuarioId) {
  const { error } = await supabase.rpc("increment_uso_mensal", {
    p_usuario_id: usuarioId,
  });
  if (error) {
    console.error("Erro ao incrementar uso:", error.message);
  }
}

async function getUsuarioByAuthId(authId) {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*, planos(limite_mensal)")
    .eq("auth_id", authId)
    .single();

  if (error || !data) return null;
  return data;
}

module.exports = { saveDiagnostico, getUsuarioByApiKey, incrementarUso, getUsuarioByAuthId };
