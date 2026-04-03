// src/routes/feedback.js
const express = require('express');
const router = express.Router();
const { getUserFromToken, getUsuarioByAuthId } = require('../db/supabase');
const { sendFeedbackEmail } = require('../email/resend');

router.post('/', async (req, res) => {
  const { mensagem } = req.body;

  if (!mensagem || typeof mensagem !== 'string' || mensagem.trim().length === 0) {
    return res.status(400).json({ erro: 'Mensagem obrigatória' });
  }
  if (mensagem.length > 2000) {
    return res.status(400).json({ erro: 'Mensagem muito longa (máximo 2000 caracteres)' });
  }

  // Auth opcional — feedback funciona anônimo ou autenticado
  let email = null;
  let plano = null;
  const header = req.headers['authorization'];
  if (header && header.startsWith('Bearer ')) {
    try {
      const token = header.slice(7).trim();
      const { data: { user }, error } = await getUserFromToken(token);
      if (!error && user) {
        const usuario = await getUsuarioByAuthId(user.id);
        if (usuario) {
          email = usuario.email;
          plano = usuario.plano_id;
        }
      }
    } catch (_) {}
  }

  await sendFeedbackEmail({ mensagem: mensagem.trim(), email, plano });

  return res.json({ ok: true });
});

module.exports = router;
