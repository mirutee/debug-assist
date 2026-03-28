// src/routes/feedback.js
const express = require('express');
const router = express.Router();
const { sendFeedbackEmail } = require('../email/resend');
const { getUserFromToken, getUsuarioByAuthId } = require('../db/supabase');

router.post('/', async (req, res) => {
  const { mensagem } = req.body;

  if (!mensagem || typeof mensagem !== 'string' || mensagem.trim().length === 0) {
    return res.status(400).json({ erro: 'Mensagem obrigatória' });
  }
  if (mensagem.length > 2000) {
    return res.status(400).json({ erro: 'Mensagem muito longa (máximo 2000 caracteres)' });
  }

  let email = null;
  let plano = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7).trim();
      const { data } = await getUserFromToken(token);
      if (data?.user?.id) {
        const usuario = await getUsuarioByAuthId(data.user.id);
        if (usuario) {
          email = usuario.email;
          plano = usuario.plano_id;
        }
      }
    } catch { /* anônimo */ }
  }

  await sendFeedbackEmail({ mensagem: mensagem.trim(), email, plano });

  return res.json({ ok: true });
});

module.exports = router;
