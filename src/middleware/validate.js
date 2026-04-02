// src/middleware/validate.js
function validate(req, res, next) {
  const { tipo, mensagem, contexto, dados } = req.body;

  // SEGURANÇA: Validar presença de campos obrigatórios
  if (!tipo) {
    return res.status(400).json({ erro: "Campo 'tipo' é obrigatório" });
  }

  if (!mensagem && dados === undefined) {
    return res.status(400).json({ erro: "Campo 'mensagem' é obrigatório" });
  }

  // SEGURANÇA: Validar tipos de dados
  if (typeof tipo !== 'string') {
    return res.status(400).json({ erro: "Campo 'tipo' deve ser string" });
  }

  if (mensagem !== undefined && typeof mensagem !== 'string') {
    return res.status(400).json({ erro: "Campo 'mensagem' deve ser string" });
  }

  if (contexto !== undefined && typeof contexto !== 'object') {
    return res.status(400).json({ erro: "Campo 'contexto' deve ser object" });
  }

  // SEGURANÇA: Limitar tamanhos para prevenir DoS
  const MAX_TIPO = 100;
  const MAX_MENSAGEM = 10000;
  const MAX_JSON_SIZE = 100000; // 100KB max para todo o payload

  if (tipo.length > MAX_TIPO) {
    return res.status(400).json({ erro: `Campo 'tipo' excede ${MAX_TIPO} caracteres` });
  }

  if (mensagem && mensagem.length > MAX_MENSAGEM) {
    return res.status(400).json({ erro: `Campo 'mensagem' excede ${MAX_MENSAGEM} caracteres` });
  }

  // Verificar tamanho total do JSON
  const totalSize = JSON.stringify(req.body).length;
  if (totalSize > MAX_JSON_SIZE) {
    return res.status(413).json({ erro: "Payload muito grande" });
  }

  next();
}

module.exports = validate;
