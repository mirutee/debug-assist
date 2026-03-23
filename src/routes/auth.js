// src/routes/auth.js
const express = require("express");
const router = express.Router();
const { validarDominio, signupLimiter } = require("../middleware/antiAbuse");
const { signUpUser, signInUser, getUserFromToken, getUsuarioByAuthId } = require("../db/supabase");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /v1/auth/signup
router.post("/signup", validarDominio, signupLimiter, async (req, res) => {
  const { email, senha } = req.body;

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ erro: "Email inválido" });
  }

  if (!senha || senha.length < 6) {
    return res.status(400).json({ erro: "Senha inválida. Mínimo 6 caracteres." });
  }

  try {
    const { error } = await signUpUser(email, senha);

    if (error) {
      if (error.message.includes("already registered")) {
        return res.status(400).json({ erro: "Email já cadastrado" });
      }
      return res.status(500).json({ erro: "Erro interno. Tente novamente." });
    }

    return res.status(201).json({ mensagem: "Conta criada com sucesso! Você já pode fazer login." });
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno. Tente novamente." });
  }
});

// POST /v1/auth/login
router.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: "Email e senha obrigatórios" });
  }

  try {
    const { data, error } = await signInUser(email, senha);

    if (error) {
      if (error.message.includes("Email not confirmed")) {
        return res.status(403).json({ erro: "Confirme seu email antes de fazer login" });
      }
      return res.status(401).json({ erro: "Email ou senha incorretos" });
    }

    return res.json({
      token: data.session.access_token,
      token_type: "Bearer",
    });
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno. Tente novamente." });
  }
});

// GET /v1/auth/me
router.get("/me", async (req, res) => {
  const header = req.headers["authorization"];

  if (!header) {
    return res.status(401).json({ erro: "Token obrigatório" });
  }

  const token = header.replace("Bearer ", "").trim();

  try {
    const { data: { user }, error } = await getUserFromToken(token);

    if (error || !user) {
      return res.status(401).json({ erro: "Token inválido" });
    }

    const usuario = await getUsuarioByAuthId(user.id);

    if (!usuario) {
      return res.status(404).json({
        erro: "Usuário não encontrado. Confirme seu email.",
      });
    }

    return res.json({
      email: usuario.email,
      plano: usuario.plano_id,
      uso_mensal: usuario.uso_mensal,
      limite_mensal: usuario.planos.limite_mensal,
      api_key: usuario.api_key,
    });
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno. Tente novamente." });
  }
});

module.exports = router;
