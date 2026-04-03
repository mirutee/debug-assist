// src/routes/diagnosticos.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const authJwt = require("../middleware/authJwt");
const validate = require("../middleware/validate");
const diagnosticar = require("../engines/index");
const planFilter = require("../engines/planFilter");
const aiEnricher = require("../engines/aiEnricher");
const { saveDiagnostico, getDiagnosticosByUsuario } = require("../db/supabase");

router.post("/", auth, validate, async (req, res) => {
  try {
    const resultado = diagnosticar(req.body);
    const filtrado = planFilter(resultado, req.usuario.plano_id);

    let final = filtrado;
    if (req.usuario.plano_id === 'scale') {
      final = await aiEnricher(filtrado, req.body, req.usuario, req.headers);
    }

    // O uso já foi incrementado atomicamente no middleware auth.js
    // (check_and_increment_uso_mensal). Nenhum incremento adicional necessário.
    saveDiagnostico({
      tipo: req.body.tipo,
      mensagem: req.body.mensagem,
      contexto: req.body.contexto,
      resposta: final,
      usuario_id: req.usuario.id,
    }).catch(() => {});

    return res.json(final);
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno ao processar diagnóstico" });
  }
});

router.get("/historico", authJwt, async (req, res) => {
  try {
    const { after } = req.query;

    // SEGURANÇA [ALTO]: Validar que after é uma timestamp ISO 8601 válida antes de
    // passar ao banco. Strings arbitrárias não devem chegar a .gt("criado_em", ...).
    let afterValidado;
    if (after !== undefined) {
      const ts = new Date(after);
      if (isNaN(ts.getTime())) {
        return res.status(400).json({ erro: "Parâmetro 'after' inválido" });
      }
      afterValidado = ts.toISOString();
    }

    const items = await getDiagnosticosByUsuario(req.usuario.id, { after: afterValidado });
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ erro: "Erro ao buscar histórico" });
  }
});

module.exports = router;
