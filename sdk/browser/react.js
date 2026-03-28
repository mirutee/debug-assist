// sdk/browser/react.js
// React ErrorBoundary component for Debug Assist
'use strict';

var React = require('react');
var core = require('./debugassist.browser.js');

var DEFAULT_BASE_URL = 'https://debug-assist.onrender.com';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true };
  }

  componentDidCatch(error, _info) {
    try {
      var apiKey = this.props.apiKey;
      var config;
      if (apiKey) {
        config = {
          apiKey: apiKey,
          projectName: this.props.projectName || 'unknown',
          baseUrl: (this.props.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ''),
        };
      } else {
        config = core._getClient(); // may be null if init() was not called
      }
      if (config) {
        core.report(error, config);
      }
    } catch (_) { /* never cascade */ }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback !== undefined ? this.props.fallback : null;
    }
    return this.props.children;
  }
}

module.exports = { ErrorBoundary: ErrorBoundary };
