// src/email/resend.js
const { Resend } = require('resend');

let _resend;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || '');
  return _resend;
}

function buildWelcomeHtml(email, apiKey) {
  const baseUrl = (process.env.APP_BASE_URL || 'https://debug-assist.onrender.com').replace(/\/$/, '');

  const apiKeyBlock = apiKey
    ? `
      <div style="margin:24px 0">
        <p style="color:#94A3B8;font-size:13px;margin:0 0 8px">Sua API Key:</p>
        <div style="background:#0D1117;border:1px solid #334155;border-radius:8px;padding:16px;font-family:'JetBrains Mono',monospace;font-size:13px;color:#4ADE80;word-break:break-all">${apiKey}</div>
      </div>`
    : `
      <p style="color:#94A3B8;font-size:14px">Sua API Key estará disponível no dashboard após confirmar seu email.</p>`;

  const curlExample = apiKey
    ? `
      <div style="margin:24px 0">
        <p style="color:#94A3B8;font-size:13px;margin:0 0 8px">Exemplo rápido:</p>
        <div style="background:#0D1117;border:1px solid #334155;border-radius:8px;padding:16px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#F8FAFC;white-space:pre-wrap">curl -X POST ${baseUrl}/v1/diagnosticos \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"/users","method":"POST","categoria":"backend"}'</div>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0F172A;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#1E293B;border:1px solid #334155;border-radius:12px;overflow:hidden">

    <!-- Header -->
    <div style="background:#0F172A;padding:24px 32px;border-bottom:1px solid #334155">
      <span style="font-family:'JetBrains Mono',monospace;font-weight:700;font-size:20px;color:#6366F1">DEBUG_Assist</span><span style="display:inline-block;width:2px;height:1em;background:#6366F1;margin-left:2px;vertical-align:middle"></span>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <h1 style="color:#F8FAFC;font-size:22px;font-weight:700;margin:0 0 8px">Bem-vindo ao DEBUG_Assist!</h1>
      <p style="color:#94A3B8;font-size:15px;margin:0 0 24px">Sua conta foi criada com sucesso para <strong style="color:#F8FAFC">${email}</strong>.</p>

      ${apiKeyBlock}
      ${curlExample}

      <!-- Botões -->
      <div style="margin:32px 0 0">
        <a href="${baseUrl}/dashboard/" style="display:inline-block;background:#6366F1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;margin-right:12px">Acessar Dashboard →</a>
        <a href="${baseUrl}/docs" style="display:inline-block;background:transparent;color:#6366F1;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;border:1px solid #6366F1">Ver Documentação</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #334155;text-align:center">
      <p style="color:#475569;font-size:12px;margin:0">© 2026 DEBUG_Assist</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendWelcomeEmail(email, apiKey) {
  try {
    await getResend().emails.send({
      from: process.env.RESEND_FROM || 'noreply@debug-assist.app',
      to: email,
      subject: 'Bem-vindo ao DEBUG_Assist — sua API Key está aqui',
      html: buildWelcomeHtml(email, apiKey),
    });
  } catch (err) {
    console.error('[email] Erro ao enviar email de boas-vindas:', err.message);
  }
}

function buildFeedbackHtml({ mensagem, email, plano }) {
  const remetente = email || 'Anônimo';
  const planoLabel = plano || '—';
  const data = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const safe = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0F172A;font-family:Inter,-apple-system,sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#1E293B;border:1px solid #334155;border-radius:12px;overflow:hidden">
    <div style="background:#0F172A;padding:24px 32px;border-bottom:1px solid #334155">
      <span style="font-family:'JetBrains Mono',monospace;font-weight:700;font-size:20px;color:#6366F1">DEBUG_Assist</span>
    </div>
    <div style="padding:32px">
      <h1 style="color:#F8FAFC;font-size:20px;margin:0 0 16px">Novo Feedback de Usuário</h1>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr><td style="color:#94A3B8;font-size:13px;padding:4px 0;width:80px">Usuário:</td><td style="color:#F8FAFC;font-size:13px">${safe(remetente)}</td></tr>
        <tr><td style="color:#94A3B8;font-size:13px;padding:4px 0">Plano:</td><td style="color:#F8FAFC;font-size:13px">${safe(planoLabel)}</td></tr>
        <tr><td style="color:#94A3B8;font-size:13px;padding:4px 0">Data:</td><td style="color:#F8FAFC;font-size:13px">${safe(data)}</td></tr>
      </table>
      <div style="background:#0D1117;border:1px solid #334155;border-radius:8px;padding:16px">
        <p style="color:#F8FAFC;font-size:14px;margin:0;white-space:pre-wrap">${safe(mensagem)}</p>
      </div>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #334155;text-align:center">
      <p style="color:#475569;font-size:12px;margin:0">© 2026 DEBUG_Assist</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendFeedbackEmail({ mensagem, email, plano }) {
  try {
    await getResend().emails.send({
      from: process.env.RESEND_FROM || 'noreply@debugassist.com.br',
      to: 'debugassistapp@gmail.com',
      subject: `Novo feedback${email ? ` de ${email}` : ''}`,
      html: buildFeedbackHtml({ mensagem, email, plano }),
    });
  } catch (err) {
    console.error('[email] Erro ao enviar feedback:', err.message);
  }
}

module.exports = { sendWelcomeEmail, sendFeedbackEmail };
