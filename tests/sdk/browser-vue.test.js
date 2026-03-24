/**
 * @jest-environment jsdom
 */
'use strict';

beforeEach(() => {
  jest.resetModules();
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

afterEach(() => {
  window.onerror = null;
});

function loadPlugin() {
  return require('../../sdk/browser/vue.js');
}

describe('Vue DevInsight plugin', () => {
  it('registers app.config.errorHandler', () => {
    const plugin = loadPlugin();
    const app = { config: {}, use: function(p, opts) { p.install(this, opts); } };
    app.use(plugin, { apiKey: 'vue-key' });
    expect(typeof app.config.errorHandler).toBe('function');
  });

  it('calls init() so window.onerror is registered', () => {
    const plugin = loadPlugin();
    const app = { config: {}, use: function(p, opts) { p.install(this, opts); } };
    app.use(plugin, { apiKey: 'vue-key', projectName: 'vue-proj' });
    expect(window.onerror).toBeInstanceOf(Function);
  });

  it('sends diagnostic when app.config.errorHandler fires', async () => {
    const plugin = loadPlugin();
    const app = { config: {}, use: function(p, opts) { p.install(this, opts); } };
    app.use(plugin, { apiKey: 'vue-key', projectName: 'vue-proj' });
    app.config.errorHandler(new TypeError('vue error'), null, 'render');
    await Promise.resolve();
    expect(fetch).toHaveBeenCalled();
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.tipo).toBe('silent_frontend_error');
    expect(body.mensagem).toBe('vue error');
  });

  it('chains a pre-existing app.config.errorHandler', async () => {
    const prev = jest.fn();
    const plugin = loadPlugin();
    const app = { config: { errorHandler: prev }, use: function(p, opts) { p.install(this, opts); } };
    app.use(plugin, { apiKey: 'vue-key' });
    app.config.errorHandler(new Error('e'), null, 'x');
    await Promise.resolve();
    expect(prev).toHaveBeenCalledWith(expect.any(Error), null, 'x');
  });
});
