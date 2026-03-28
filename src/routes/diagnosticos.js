// src/routes/diagnosticos.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const authJwt = require("../middleware/authJwt");
const validate = require("../middleware/validate");
const diagnosticar = require("../engines/index");
const planFilter = require("../engines/planFilter");
const { saveDiagnostico, incrementarUso, getDiagnosticosByUsuario } = require("../db/supabase");

router.post("/", auth, validate, async (req, res) => {
  try {
    const resultado = diagnosticar(req.body);
    const filtrado = planFilter(resultado, req.usuario.plano_id);

    // Persiste de forma assíncrona — não bloqueia a resposta
    saveDiagnostico({
      tipo: req.body.tipo,
      mensagem: req.body.mensagem,
      contexto: req.body.contexto,
      resposta: filtrado,
      usuario_id: req.usuario.id,
    }).catch(() => {});

    // Incrementa cota após resposta bem-sucedida
    res.on("finish", () => {
      if (res.statusCode === 200) {
        incrementarUso(req.usuario.id).catch(() => {});
      }
    });

    return res.json(filtrado);
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno ao processar diagnóstico" });
  }
});

router.get("/historico", authJwt, async (req, res) => {
  try {
    const { after } = req.query;
    const items = await getDiagnosticosByUsuario(req.usuario.id, { after });
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ erro: "Erro ao buscar histórico" });
  }
});

module.exports = router;
