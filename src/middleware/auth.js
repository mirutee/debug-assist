// src/middleware/auth.js
function auth(req, res, next) {
  const header = req.headers["authorization"];

  if (!header) {
    return res.status(401).json({ erro: "API Key obrigatória" });
  }

  const token = header.replace("Bearer ", "").trim();

  if (token !== process.env.API_KEY) {
    return res.status(401).json({ erro: "API Key inválida" });
  }

  next();
}

module.exports = auth;
