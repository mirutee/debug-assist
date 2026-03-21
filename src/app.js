// src/app.js
require("dotenv").config();
const express = require("express");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");

const app = express();
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 60,             // 60 req/min por IP (bem acima do uso normal, bloqueia brute-force)
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Tente novamente em 1 minuto." },
});

const swaggerDocument = YAML.load(path.join(__dirname, "../swagger.yaml"));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use("/health", require("./routes/health"));
app.use("/v1/auth", require("./routes/auth"));
app.use("/v1/diagnosticos", limiter, require("./routes/diagnosticos"));

module.exports = app;
