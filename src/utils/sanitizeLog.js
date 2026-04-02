// SEGURANÇA: Sanitize dados sensíveis de logs
function sanitizeLog(message) {
  if (!message) return message;

  // Remover API keys, secrets, tokens
  return String(message)
    .replace(/api[_-]?key[:\s]*['\"]?[a-zA-Z0-9_\-]+['\"]?/gi, 'API_KEY_REDACTED')
    .replace(/stripe[_-]?key[:\s]*['\"]?[a-zA-Z0-9_\-]+['\"]?/gi, 'STRIPE_KEY_REDACTED')
    .replace(/secret[:\s]*['\"]?[a-zA-Z0-9_\-]+['\"]?/gi, 'SECRET_REDACTED')
    .replace(/token[:\s]*['\"]?[a-zA-Z0-9_\-\.]+['\"]?/gi, 'TOKEN_REDACTED')
    .replace(/password[:\s]*['\"]?[a-zA-Z0-9_\-]+['\"]?/gi, 'PASSWORD_REDACTED')
    .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'BEARER_TOKEN_REDACTED');
}

module.exports = { sanitizeLog };
