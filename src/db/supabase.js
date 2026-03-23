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

async function signUpUser(email, senha) {
  return supabase.auth.signUp({ email, password: senha });
}

async function signInUser(email, senha) {
  return supabase.auth.signInWithPassword({ email, password: senha });
}

async function getUserFromToken(token) {
  return supabase.auth.getUser(token);
}

async function getUsuarioById(usuarioId) {
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, email, plano_id, stripe_customer_id")
    .eq("id", usuarioId)
    .single();

  if (error || !data) return null;
  return data;
}

async function updatePlanoBilling(usuarioId, { plano_id, stripe_customer_id }) {
  const updates = {};
  if (plano_id !== undefined) updates.plano_id = plano_id;
  if (stripe_customer_id !== undefined) updates.stripe_customer_id = stripe_customer_id;

  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase
    .from("usuarios")
    .update(updates)
    .eq("id", usuarioId);

  if (error) throw new Error(error.message);
}

async function getUsuarioByStripeCustomerId(stripeCustomerId) {
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, plano_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .single();

  if (error || !data) return null;
  return data;
}

module.exports = {
  saveDiagnostico,
  getUsuarioByApiKey,
  incrementarUso,
  getUsuarioByAuthId,
  signUpUser,
  signInUser,
  getUserFromToken,
  getUsuarioById,
  updatePlanoBilling,
  getUsuarioByStripeCustomerId,
};
