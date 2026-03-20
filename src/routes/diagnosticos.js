// src/routes/diagnosticos.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const diagnosticar = require("../engines/index");

router.post("/", auth, validate, async (req, res) => {
  try {
    const resultado = diagnosticar(req.body);
    return res.json(resultado);
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno ao processar diagnóstico" });
  }
});

module.exports = router;
