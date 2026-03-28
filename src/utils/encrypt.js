const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function getKey() {
  const hex = process.env.AI_KEY_SECRET;
  if (!hex) throw new Error('[DebugAssist] AI_KEY_SECRET não configurado — impossível encriptar chave de IA.');
  return Buffer.from(hex, 'hex');
}

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), encrypted.toString('hex'), tag.toString('hex')].join(':');
}

function decrypt(stored) {
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('Formato de dado encriptado inválido');
  const [ivHex, encHex, tagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc, null, 'utf8') + decipher.final('utf8');
}

module.exports = { encrypt, decrypt };
