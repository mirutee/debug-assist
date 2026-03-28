// src/middleware/auth.js
const { getUsuarioByApiKey } = require("../db/supabase");

async function auth(req, res, next) {
  const header = req.headers["authorization"];

  if (!header) {
    return res.status(401).json({ erro: "API Key obrigatória" });
  }

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "API Key obrigatória" });
  }

  const apiKey = header.slice(7).trim();

  try {
    const usuario = await getUsuarioByApiKey(apiKey);

    if (!usuario) {
      return res.status(401).json({ erro: "API Key inválida" });
    }

    if (!usuario.planos) {
      return res.status(500).json({ erro: "Erro interno. Tente novamente." });
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
      ai_key_encrypted: usuario.ai_key_encrypted || null,
      ai_provider: usuario.ai_provider || null,
    };

    next();
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno. Tente novamente." });
  }
}

module.exports = auth;
