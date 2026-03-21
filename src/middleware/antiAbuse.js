// src/middleware/antiAbuse.js
const rateLimit = require("express-rate-limit");
const BLOCKED_DOMAINS = require("../data/blocked-domains");

function validarDominio(req, res, next) {
  const { email } = req.body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ erro: "Email inválido" });
  }

  const domain = email.split("@")[1].toLowerCase();

  if (BLOCKED_DOMAINS.has(domain)) {
    return res.status(400).json({ erro: "Email não permitido" });
  }

  next();
}

const signupLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 horas
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: { erro: "Limite de cadastros atingido. Tente novamente em 24h." },
  skip: () => process.env.NODE_ENV === "test",
});

module.exports = { validarDominio, signupLimiter };
