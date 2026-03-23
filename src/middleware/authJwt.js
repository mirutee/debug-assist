// src/middleware/authJwt.js
const { getUserFromToken, getUsuarioByAuthId } = require("../db/supabase");

async function authJwt(req, res, next) {
  const header = req.headers["authorization"];

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Token obrigatório" });
  }

  const token = header.slice(7).trim();

  try {
    const { data: { user }, error } = await getUserFromToken(token);

    if (error || !user) {
      return res.status(401).json({ erro: "Token inválido" });
    }

    const usuario = await getUsuarioByAuthId(user.id);

    if (!usuario) {
      return res.status(401).json({ erro: "Token inválido" });
    }

    req.usuario = {
      id: usuario.id,
      email: usuario.email,
      plano_id: usuario.plano_id,
      stripe_customer_id: usuario.stripe_customer_id,
    };

    next();
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno. Tente novamente." });
  }
}

module.exports = authJwt;
