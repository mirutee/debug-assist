// sdk/browser/svelte.js
// Svelte wrapper for DevInsight — delegates to core window.onerror hook
// Svelte does not expose a global component error hook; window.onerror covers all crashes
'use strict';

var core = require('./devinsight.browser.js');

function initDevInsight(opts) {
  core.init(opts);
}

module.exports = { initDevInsight: initDevInsight };
