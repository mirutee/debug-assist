// src/routes/analytics.js
const express = require("express");
const router = express.Router();
const { getUserFromToken, getUsuarioByAuthId, getAnalyticsByUsuario } = require("../db/supabase");

router.get("/", async (req, res) => {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).json({ erro: "Token obrigatório" });

  const token = header.replace("Bearer ", "").trim();

  try {
    const { data: { user }, error } = await getUserFromToken(token);
    if (error || !user) return res.status(401).json({ erro: "Token inválido" });

    const usuario = await getUsuarioByAuthId(user.id);
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });

    const dados = await getAnalyticsByUsuario(usuario.id);
    return res.json({ dados });
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno. Tente novamente." });
  }
});

module.exports = router;
