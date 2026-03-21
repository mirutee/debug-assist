// src/middleware/auth.js
const { getUsuarioByApiKey } = require("../db/supabase");

async function auth(req, res, next) {
  const header = req.headers["authorization"];

  if (!header) {
    return res.status(401).json({ erro: "API Key obrigatória" });
  }

  const apiKey = header.replace("Bearer ", "").trim();
  const usuario = await getUsuarioByApiKey(apiKey);

  if (!usuario) {
    return res.status(401).json({ erro: "API Key inválida" });
  }

  const limiteMensal = usuario.planos.limite_mensal;
  if (limiteMensal !== -1 && usuario.uso_mensal >= limiteMensal) {
    return res.status(429).json({
      erro: "Cota mensal esgotada. Faça upgrade do seu plano.",
    });
  }

  req.usuario = {
    id: usuario.id,
    plano_id: usuario.plano_id,
    uso_mensal: usuario.uso_mensal,
    limite_mensal: limiteMensal,
  };

  next();
}

module.exports = auth;
