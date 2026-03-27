// sdk/browser/vue.js
// Vue 3 plugin for Debug Assist
'use strict';

var core = require('./devinsight.browser.js');

var Debug AssistPlugin = {
  install: function (app, opts) {
    var apiKey = (opts && opts.apiKey) || '';
    var projectName = (opts && opts.projectName) || 'unknown';
    var baseUrl = (opts && opts.baseUrl);

    if (apiKey) {
      core.init({ apiKey: apiKey, projectName: projectName, baseUrl: baseUrl });
    }

    var prev = app.config.errorHandler || null;
    app.config.errorHandler = function (err, vm, info) {
      try {
        core.report(err);
      } catch (_) {}
      if (prev) prev(err, vm, info);
    };
  },
};

module.exports = Debug AssistPlugin;
