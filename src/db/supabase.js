// src/db/supabase.js
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

let _supabase = null;
function db() {
  if (!_supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      console.warn("[DebugAssist] AVISO: SUPABASE_URL ou SUPABASE_KEY não configurados — diagnósticos não serão persistidos.");
      return null;
    }
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }
  return _supabase;
}

async function saveDiagnostico({ tipo, mensagem, contexto, resposta, usuario_id }) {
  const client = db();
  if (!client) return;
  const { error } = await client
    .from("diagnosticos")
    .insert({ tipo, mensagem, contexto, resposta, usuario_id: usuario_id || null });

  if (error) {
    console.error("Erro ao salvar diagnóstico no Supabase:", error.message);
  }
}

async function getDiagnosticosByUsuario(usuarioId, { after } = {}) {
  const client = db();
  if (!client) return [];
  let query = client
    .from("diagnosticos")
    .select("id, tipo, criado_em, resposta, mensagem, contexto")
    .eq("usuario_id", usuarioId)
    .order("criado_em", { ascending: false })
    .limit(50);

  if (after) query = query.gt("criado_em", after);

  const { data, error } = await query;
  if (error) throw new Error(error.message || "Erro ao buscar diagnósticos");
  return data || [];
}

async function getUsuarioByApiKey(apiKey) {
  const client = db();
  if (!client) return null;
  const { data, error } = await client
    .from("usuarios")
    .select("*, planos(limite_mensal)")
    .eq("api_key", apiKey)
    .eq("ativo", true)
    .single();

  if (error || !data) return null;
  return data;
}

async function incrementarUso(usuarioId) {
  const client = db();
  if (!client) return;
  const { error } = await client.rpc("increment_uso_mensal", {
    p_usuario_id: usuarioId,
  });
  if (error) {
    console.error("Erro ao incrementar uso:", error.message);
  }
}

async function getUsuarioByAuthId(authId) {
  const client = db();
  if (!client) return null;
  const { data, error } = await client
    .from("usuarios")
    .select("*, planos(limite_mensal)")
    .eq("auth_id", authId)
    .single();

  if (error || !data) return null;
  return data;
}

async function signUpUser(email, senha) {
  return db().auth.signUp({ email, password: senha });
}

async function signInUser(email, senha) {
  return db().auth.signInWithPassword({ email, password: senha });
}

async function getUserFromToken(token) {
  return db().auth.getUser(token);
}

async function getUsuarioById(usuarioId) {
  const client = db();
  if (!client) return null;
  const { data, error } = await client
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

  const client = db();
  if (!client) return;
  const { error } = await client
    .from("usuarios")
    .update(updates)
    .eq("id", usuarioId);

  if (error) throw new Error(error.message);
}

async function getUsuarioByStripeCustomerId(stripeCustomerId) {
  const client = db();
  if (!client) return null;
  const { data, error } = await client
    .from("usuarios")
    .select("id, plano_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .single();

  if (error || !data) return null;
  return data;
}

async function regenerateApiKey(usuarioId) {
  const client = db();
  if (!client) throw new Error("Banco de dados não configurado");
  const { data, error } = await client
    .from("usuarios")
    .update({ api_key: crypto.randomUUID() })
    .eq("id", usuarioId)
    .select("api_key")
    .single();

  if (error || !data) throw new Error(error?.message || "Erro ao regenerar API key");
  return data.api_key;
}

async function getAnalyticsByUsuario(usuarioId) {
  const client = db();
  if (!client) return [];
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await client
    .from("diagnosticos")
    .select("criado_em")
    .eq("usuario_id", usuarioId)
    .gte("criado_em", since.toISOString());

  if (error) throw new Error(error.message);

  const counts = {};
  for (const row of data || []) {
    const date = row.criado_em.slice(0, 10);
    counts[date] = (counts[date] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([data, total]) => ({ data, total }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

module.exports = {
  saveDiagnostico,
  getDiagnosticosByUsuario,
  getUsuarioByApiKey,
  incrementarUso,
  getUsuarioByAuthId,
  signUpUser,
  signInUser,
  getUserFromToken,
  getUsuarioById,
  updatePlanoBilling,
  getUsuarioByStripeCustomerId,
  regenerateApiKey,
  getAnalyticsByUsuario,
};
