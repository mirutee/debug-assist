// sdk/browser/svelte.js
// Svelte wrapper for Debug Assist — delegates to core window.onerror hook
// Svelte does not expose a global component error hook; window.onerror covers all crashes
'use strict';

var core = require('./devinsight.browser.js');

function initDebug Assist(opts) {
  core.init(opts);
}

module.exports = { initDebug Assist: initDebug Assist };
