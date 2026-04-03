// src/middleware/auth.js
const { getUsuarioByApiKey, checkAndIncrementUso } = require("../db/supabase");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function auth(req, res, next) {
  const header = req.headers["authorization"];

  if (!header) {
    return res.status(401).json({ erro: "API Key obrigatória" });
  }

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "API Key obrigatória" });
  }

  const apiKey = header.slice(7).trim();

  // SEGURANÇA [ALTO]: Validar formato UUID antes de consultar o banco.
  // Sem isso, strings de tamanho arbitrário chegam à query como parâmetro.
  if (!UUID_REGEX.test(apiKey)) {
    return res.status(401).json({ erro: "API Key inválida" });
  }

  try {
    const usuario = await getUsuarioByApiKey(apiKey);

    if (!usuario) {
      return res.status(401).json({ erro: "API Key inválida" });
    }

    if (!usuario.planos) {
      return res.status(500).json({ erro: "Erro interno. Tente novamente." });
    }

    const limiteMensal = usuario.planos.limite_mensal;

    // SEGURANÇA [CRÍTICO]: check + increment atômico no banco (elimina TOCTOU).
    // A verificação e o incremento ocorrem em uma única transação com FOR UPDATE,
    // impedindo que dois requests paralelos ultrapassem a cota simultaneamente.
    const permitido = await checkAndIncrementUso(usuario.id, limiteMensal);
    if (!permitido) {
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
