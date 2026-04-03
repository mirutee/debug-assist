// src/routes/analytics.js
const express = require("express");
const router = express.Router();
const authJwt = require("../middleware/authJwt");
const { getAnalyticsByUsuario } = require("../db/supabase");

router.get("/", authJwt, async (req, res) => {
  try {
    const dados = await getAnalyticsByUsuario(req.usuario.id);
    return res.json({ dados });
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno. Tente novamente." });
  }
});

module.exports = router;
