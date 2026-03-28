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

function loadSvelte() {
  return require('../../sdk/browser/svelte.js');
}

describe('Svelte DevInsight wrapper', () => {
  it('exports initDebugAssist function', () => {
    const { initDebugAssist } = loadSvelte();
    expect(typeof initDebugAssist).toBe('function');
  });

  it('registers window.onerror when called with apiKey', () => {
    const { initDebugAssist } = loadSvelte();
    initDebugAssist({ apiKey: 'svelte-key', projectName: 'svelte-proj' });
    expect(window.onerror).toBeInstanceOf(Function);
  });

  it('captures errors via window.onerror after initDebugAssist()', async () => {
    const { initDebugAssist } = loadSvelte();
    initDebugAssist({ apiKey: 'svelte-key', projectName: 'svelte-proj' });
    window.onerror('crash', 'file.js', 1, 1, new Error('svelte crash'));
    await Promise.resolve();
    expect(fetch).toHaveBeenCalled();
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.contexto.project_name).toBe('svelte-proj');
  });
});
