// src/app.js
require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");

const app = express();

// SEGURANÇA: trust proxy — necessário para req.ip ser o IP real do cliente atrás do Render/nginx.
// Sem isso, todos os rate limiters usam o IP interno do proxy (mesmo IP para todos os usuários).
app.set('trust proxy', 1);

// SEGURANÇA: Adicionar headers de segurança com Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"], // jsdelivr para SDK Supabase
      scriptSrcAttr: ["'unsafe-inline'"], // Helmet 7+ bloqueia onclick por padrão; precisamos liberar
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://*.supabase.co"], // Supabase Auth para OAuth
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// SEGURANÇA: CORS explícito (não permissivo)
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://debugassist.com.br',
    'http://localhost:3000',
    'http://localhost:5000',
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
// Raw body para validação de assinatura do Stripe (deve vir antes do express.json)
app.use('/v1/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Serve arquivos estáticos de public/ (landing page em /, dashboard em /dashboard/)
app.use(express.static(path.join(__dirname, "../public")));
app.use("/dashboard", express.static(path.join(__dirname, "../public/dashboard")));

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 60,             // 60 req/min por IP (bem acima do uso normal, bloqueia brute-force)
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Tente novamente em 1 minuto." },
});

const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,                    // 5 envios por hora por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitos feedbacks enviados. Tente novamente em 1 hora." },
});

// SEGURANÇA: Rate limit para autenticação (previne brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 5,                     // 5 tentativas por 15 min por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas. Tente novamente em 15 minutos." },
  skip: () => process.env.NODE_ENV === "test",
});

// SEGURANÇA: Rate limit para billing (previne abuso)
const billingLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minuto
  max: 10,                    // 10 requisições por minuto por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Tente novamente em 1 minuto." },
  skip: () => process.env.NODE_ENV === "test",
});

const swaggerDocument = YAML.load(path.join(__dirname, "../swagger.yaml"));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/health", require("./routes/health"));
app.use("/v1/auth", authLimiter, require("./routes/auth"));
app.use("/v1/diagnosticos", limiter, require("./routes/diagnosticos"));
app.use("/v1/billing", billingLimiter, require("./routes/billing"));
app.use("/v1/analytics", limiter, require("./routes/analytics"));
app.use("/v1/feedback", feedbackLimiter, require("./routes/feedback"));

module.exports = app;
