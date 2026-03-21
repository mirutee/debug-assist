// src/routes/diagnosticos.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const diagnosticar = require("../engines/index");
const { saveDiagnostico, incrementarUso } = require("../db/supabase");

router.post("/", auth, validate, async (req, res) => {
  try {
    const resultado = diagnosticar(req.body);

    // Persiste de forma assíncrona — não bloqueia a resposta
    saveDiagnostico({
      tipo: req.body.tipo,
      mensagem: req.body.mensagem,
      contexto: req.body.contexto,
      resposta: resultado,
    }).catch(() => {});

    // Incrementa cota após resposta bem-sucedida
    res.on("finish", () => {
      if (res.statusCode === 200) {
        incrementarUso(req.usuario.id).catch(() => {});
      }
    });

    return res.json(resultado);
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno ao processar diagnóstico" });
  }
});

module.exports = router;
