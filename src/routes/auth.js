// src/routes/auth.js
const express = require("express");
const router = express.Router();
const { validarDominio, signupLimiter } = require("../middleware/antiAbuse");
const { signUpUser, signInUser, getUserFromToken, getUsuarioByAuthId, regenerateApiKey, getAiConfig, saveAiConfig } = require("../db/supabase");
const { sendWelcomeEmail } = require('../email/resend');
const authJwt = require('../middleware/authJwt');
const { encrypt } = require('../utils/encrypt');

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
    const { data, error } = await signUpUser(email, senha);

    if (error) {
      // SEGURANÇA: Não revelar se email está cadastrado (evita enumeration)
      if (error.message.includes("already registered")) {
        return res.status(400).json({ erro: "Email ou senha inválidos. Tente novamente." });
      }
      return res.status(500).json({ erro: "Erro interno. Tente novamente." });
    }

    // Buscar API key para o email (fire-and-forget — nunca bloqueia o signup)
    const authId = data?.user?.id;
    let apiKey = null;
    if (authId) {
      try {
        const usuario = await getUsuarioByAuthId(authId);
        apiKey = usuario?.api_key || null;
      } catch (_) {}
    }
    sendWelcomeEmail(email, apiKey).catch(() => {});

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
      // SEGURANÇA: Não revelar se usuário existe ou precisa confirmar email
      return res.status(401).json({ erro: "Token inválido" });
    }

    return res.json({
      email: usuario.email,
      plano: usuario.plano_id,
      uso_mensal: usuario.uso_mensal,
      limite_mensal: usuario.planos.limite_mensal,
      // SEGURANÇA: Nunca retornar api_key em endpoint GET
      // API key só deve ser obtido em signup/regenerate-key com precauções extras
    });
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno. Tente novamente." });
  }
});

// POST /v1/auth/regenerate-key
router.post("/regenerate-key", async (req, res) => {
  const header = req.headers["authorization"];
  if (!header) return res.status(401).json({ erro: "Token obrigatório" });

  const token = header.replace("Bearer ", "").trim();

  try {
    const { data: { user }, error } = await getUserFromToken(token);
    if (error || !user) return res.status(401).json({ erro: "Token inválido" });

    const usuario = await getUsuarioByAuthId(user.id);
    if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });

    const apiKey = await regenerateApiKey(usuario.id);
    return res.json({ api_key: apiKey });
  } catch (err) {
    return res.status(500).json({ erro: "Erro interno. Tente novamente." });
  }
});

// GET /v1/auth/api-key — retorna API key (requer autenticação JWT)
// SEGURANÇA: Endpoint separado, apenas JWT, sem caching
router.get('/api-key', authJwt, async (req, res) => {
  try {
    // Usuário já autenticado via authJwt, retorna apenas sua própria API key
    const usuario = await require('../db/supabase').getUsuarioById(req.usuario.id);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }
    return res.json({ api_key: usuario.api_key });
  } catch {
    return res.status(500).json({ erro: 'Erro ao buscar API key' });
  }
});

// GET /v1/auth/ai-config — retorna provider configurado (nunca retorna a key)
router.get('/ai-config', authJwt, async (req, res) => {
  try {
    const config = await getAiConfig(req.usuario.id);
    return res.json({
      ai_provider: config?.ai_provider || null,
      ai_key_configured: !!(config?.ai_key_encrypted),
    });
  } catch {
    return res.status(500).json({ erro: 'Erro ao buscar configuração de IA' });
  }
});

// PUT /v1/auth/ai-config — salva ou remove a key de IA
router.put('/ai-config', authJwt, async (req, res) => {
  if (req.usuario.plano_id !== 'scale') {
    return res.status(403).json({ erro: 'Configuração de IA disponível apenas no plano Scale.' });
  }

  const { ai_key, ai_provider } = req.body;

  // remover key
  if (ai_key === null || ai_key === '') {
    try {
      await saveAiConfig(req.usuario.id, { ai_key_encrypted: null, ai_provider: null });
      return res.json({ ok: true, ai_key_configured: false });
    } catch {
      return res.status(500).json({ erro: 'Erro ao remover configuração de IA' });
    }
  }

  const PROVIDERS = ['openai', 'anthropic', 'groq'];
  if (!ai_key || typeof ai_key !== 'string' || ai_key.trim().length < 10) {
    return res.status(400).json({ erro: 'ai_key inválida' });
  }
  if (!PROVIDERS.includes(ai_provider)) {
    return res.status(400).json({ erro: `ai_provider deve ser um de: ${PROVIDERS.join(', ')}` });
  }

  try {
    const encrypted = encrypt(ai_key.trim());
    await saveAiConfig(req.usuario.id, { ai_key_encrypted: encrypted, ai_provider });
    return res.json({ ok: true, ai_key_configured: true, ai_provider });
  } catch {
    return res.status(500).json({ erro: 'Erro ao salvar configuração de IA' });
  }
});

module.exports = router;
