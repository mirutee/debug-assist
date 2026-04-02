// src/routes/feedback.js
const express = require('express');
const router = express.Router();
const authJwt = require('../middleware/authJwt');
const { sendFeedbackEmail } = require('../email/resend');

router.post('/', authJwt, async (req, res) => {
  const { mensagem } = req.body;

  if (!mensagem || typeof mensagem !== 'string' || mensagem.trim().length === 0) {
    return res.status(400).json({ erro: 'Mensagem obrigatória' });
  }
  if (mensagem.length > 2000) {
    return res.status(400).json({ erro: 'Mensagem muito longa (máximo 2000 caracteres)' });
  }

  await sendFeedbackEmail({
    mensagem: mensagem.trim(),
    email: req.usuario.email,
    plano: req.usuario.plano_id
  });

  return res.json({ ok: true });
});

module.exports = router;
