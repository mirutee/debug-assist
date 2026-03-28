// sdk/browser/svelte.js
// Svelte wrapper for Debug Assist — delegates to core window.onerror hook
// Svelte does not expose a global component error hook; window.onerror covers all crashes
'use strict';

var core = require('./debugassist.browser.js');

function initDebugAssist(opts) {
  core.init(opts);
}

module.exports = { initDebugAssist: initDebugAssist };
