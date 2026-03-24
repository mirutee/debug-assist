// sdk/browser/devinsight.browser.js
// UMD — works as <script> tag (window.DevInsight) and CommonJS (require)
(function (global, factory) {
  'use strict';
  if (typeof exports !== 'undefined') {
    module.exports = factory();
  } else {
    global.DevInsight = factory();
  }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var DEFAULT_BASE_URL = 'https://devinsight-api.onrender.com';
  var _initialized = false;
  var _client = null;

  function _isDisabled() {
    if (typeof document === 'undefined') return false;
    var meta = document.querySelector('meta[name="devinsight-enabled"]');
    return meta !== null && meta.getAttribute('content') === '0';
  }

  function _exType(err) {
    return (err && err.constructor && err.constructor.name) ? err.constructor.name : 'Error';
  }

  function _send(config, mensagem, exceptionType, stack) {
    try {
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var tid = controller ? setTimeout(function () { controller.abort(); }, 10000) : null;
      var reqOpts = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + config.apiKey,
        },
        body: JSON.stringify({
          tipo: 'silent_frontend_error',
          mensagem: mensagem,
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
      fetch(config.baseUrl + '/v1/diagnosticos', reqOpts)
        .then(function () { if (tid) clearTimeout(tid); })
        .catch(function () { if (tid) clearTimeout(tid); });
    } catch (_) { /* never cascade */ }
  }

  var DevInsight = {
    init: function (opts) {
      if (_initialized) return;
      if (_isDisabled()) return;
      var apiKey = (opts && opts.apiKey) || '';
      if (!apiKey) return;
      var projectName = (opts && opts.projectName) || 'unknown';
      var baseUrl = ((opts && opts.baseUrl) || DEFAULT_BASE_URL).replace(/\/+$/, '');
      _initialized = true;
      _client = { apiKey: apiKey, projectName: projectName, baseUrl: baseUrl };

      var prev = (typeof window !== 'undefined' && window.onerror) ? window.onerror : null;
      window.onerror = function (msg, _src, _line, _col, err) {
        try {
          _send(_client,
            err ? err.message : String(msg),
            err ? _exType(err) : 'Error',
            err ? (err.stack || '') : ''
          );
        } catch (_) {}
        if (prev) return prev.apply(this, arguments);
        return false;
      };

      window.addEventListener('unhandledrejection', function (ev) {
        try {
          var reason = ev.reason;
          var isErr = reason instanceof Error;
          _send(_client,
            isErr ? reason.message : String(reason),
            isErr ? _exType(reason) : 'UnhandledRejection',
            isErr ? (reason.stack || '') : ''
          );
        } catch (_) {}
      });
    },

    report: function (error, config) {
      var c = config || _client;
      if (!c || !c.apiKey) return;
      var isErr = error instanceof Error;
      _send(c,
        isErr ? error.message : String(error),
        isErr ? _exType(error) : 'Error',
        isErr ? (error.stack || '') : ''
      );
    },

    _getClient: function () { return _client; },
    _reset: function () { _initialized = false; _client = null; },
  };

  // CDN auto-init: read data-api-key from the current <script> tag at load time
  if (typeof document !== 'undefined') {
    var _currentScript = document.currentScript;
    if (_currentScript && _currentScript.getAttribute('data-api-key')) {
      var _autoInit = function () {
        DevInsight.init({
          apiKey: _currentScript.getAttribute('data-api-key'),
          projectName: _currentScript.getAttribute('data-project') || 'unknown',
          baseUrl: _currentScript.getAttribute('data-base-url') || DEFAULT_BASE_URL,
        });
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _autoInit);
      } else {
        _autoInit();
      }
    }
  }

  return DevInsight;
}));
