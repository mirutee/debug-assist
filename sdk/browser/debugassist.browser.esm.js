// sdk/browser/devinsight.browser.esm.js
// ESM — for bundlers (Vite, Rollup, webpack 5) that respect the "module" field
const DEFAULT_BASE_URL = 'https://debug-assist.onrender.com';
let _initialized = false;
let _client = null;

function _isDisabled() {
  if (typeof document === 'undefined') return false;
  const meta = document.querySelector('meta[name="debug-assist-enabled"]');
  return meta !== null && meta.getAttribute('content') === '0';
}

function _exType(err) {
  return (err && err.constructor && err.constructor.name) ? err.constructor.name : 'Error';
}

function _send(config, mensagem, exceptionType, stack) {
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tid = controller ? setTimeout(() => controller.abort(), 10000) : null;
    const reqOpts = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        tipo: 'silent_frontend_error',
        mensagem,
        contexto: {
          project_name: config.projectName,
          exception_type: exceptionType,
          stack: stack || '',
          url: typeof location !== 'undefined' ? location.href : '',
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        },
      }),
    };
    if (controller) reqOpts.signal = controller.signal;
    fetch(`${config.baseUrl}/v1/diagnosticos`, reqOpts)
      .then(() => { if (tid) clearTimeout(tid); })
      .catch(() => { if (tid) clearTimeout(tid); });
  } catch (_) { /* never cascade */ }
}

export function init(opts = {}) {
  if (_initialized) return;
  if (_isDisabled()) return;
  const apiKey = opts.apiKey || '';
  if (!apiKey) return;
  const projectName = opts.projectName || 'unknown';
  const baseUrl = (opts.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  _initialized = true;
  _client = { apiKey, projectName, baseUrl };

  const prev = (typeof window !== 'undefined' && window.onerror) ? window.onerror : null;
  window.onerror = function (msg, _src, _line, _col, err) {
    try {
      _send(_client, err ? err.message : String(msg), err ? _exType(err) : 'Error', err ? (err.stack || '') : '');
    } catch (_) {}
    if (prev) return prev.apply(this, arguments);
    return false;
  };

  window.addEventListener('unhandledrejection', (ev) => {
    try {
      const reason = ev.reason;
      const isErr = reason instanceof Error;
      _send(_client, isErr ? reason.message : String(reason), isErr ? _exType(reason) : 'UnhandledRejection', isErr ? (reason.stack || '') : '');
    } catch (_) {}
  });
}

export function report(error, config) {
  const c = config || _client;
  if (!c || !c.apiKey) return;
  const isErr = error instanceof Error;
  _send(c, isErr ? error.message : String(error), isErr ? _exType(error) : 'Error', isErr ? (error.stack || '') : '');
}

export function _getClient() { return _client; }
export function _reset() { _initialized = false; _client = null; }

export default { init, report, _getClient, _reset };
