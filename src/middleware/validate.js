// src/middleware/validate.js
function validate(req, res, next) {
  const { tipo, mensagem } = req.body;

  if (!tipo) {
    return res.status(400).json({ erro: "Campo 'tipo' é obrigatório" });
  }

  if (!mensagem && req.body.dados === undefined) {
    return res.status(400).json({ erro: "Campo 'mensagem' é obrigatório" });
  }

  next();
}

module.exports = validate;
