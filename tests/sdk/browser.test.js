/**
 * @jest-environment jsdom
 */
'use strict';

// Reset module between tests so _initialized state is fresh
beforeEach(() => {
  jest.resetModules();
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

afterEach(() => {
  window.onerror = null;
});

function loadSdk() {
  return require('../../sdk/browser/debugassist.browser.js');
}

describe('DevInsight browser SDK — init()', () => {
  it('does nothing when apiKey is absent', () => {
    const DI = loadSdk();
    DI.init({});
    expect(window.onerror).toBeNull();
  });

  it('registers window.onerror when apiKey is provided', () => {
    const DI = loadSdk();
    DI.init({ apiKey: 'test-key' });
    expect(window.onerror).toBeInstanceOf(Function);
  });

  it('does not register hooks when meta debug-assist-enabled="0"', () => {
    const meta = document.createElement('meta');
    meta.name = 'debug-assist-enabled';
    meta.content = '0';
    document.head.appendChild(meta);
    const DI = loadSdk();
    DI.init({ apiKey: 'test-key' });
    expect(window.onerror).toBeNull();
    document.head.removeChild(meta);
  });

  it('chains a pre-existing window.onerror', () => {
    const prev = jest.fn().mockReturnValue(false);
    window.onerror = prev;
    const DI = loadSdk();
    DI.init({ apiKey: 'test-key' });
    window.onerror('msg', 'file.js', 1, 1, new Error('test'));
    expect(prev).toHaveBeenCalled();
  });

  it('does not register hooks twice on repeated init() calls', () => {
    const DI = loadSdk();
    DI.init({ apiKey: 'test-key' });
    const handler1 = window.onerror;
    DI.init({ apiKey: 'other-key' });
    expect(window.onerror).toBe(handler1);
  });
});

describe('DevInsight browser SDK — payload', () => {
  it('sends correct payload on window.onerror', async () => {
    const DI = loadSdk();
    DI.init({ apiKey: 'my-key', projectName: 'proj' });
    const err = new TypeError('bad value');
    window.onerror('bad value', 'file.js', 1, 1, err);
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledWith(
      'https://debug-assist.onrender.com/v1/diagnosticos',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer my-key' }),
      })
    );
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.tipo).toBe('silent_frontend_error');
    expect(body.mensagem).toBe('bad value');
    expect(body.contexto.project_name).toBe('proj');
    expect(body.contexto.exception_type).toBe('TypeError');
  });

  it('uses custom baseUrl', async () => {
    const DI = loadSdk();
    DI.init({ apiKey: 'key', baseUrl: 'http://localhost:3000' });
    window.onerror('msg', 'f.js', 1, 1, new Error('e'));
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/diagnosticos',
      expect.anything()
    );
  });

  it('sends on unhandledrejection', async () => {
    const DI = loadSdk();
    DI.init({ apiKey: 'key' });
    const reason = new Error('rejected');
    window.dispatchEvent(
      Object.assign(new Event('unhandledrejection'), { reason, promise: Promise.resolve() })
    );
    await Promise.resolve();
    expect(fetch).toHaveBeenCalled();
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.tipo).toBe('silent_frontend_error');
    expect(body.mensagem).toBe('rejected');
  });

  it('silently ignores fetch failures', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
    const DI = loadSdk();
    DI.init({ apiKey: 'key' });
    expect(() => window.onerror('msg', 'f.js', 1, 1, new Error('e'))).not.toThrow();
    await Promise.resolve();
  });
});

describe('DevInsight browser SDK — report()', () => {
  it('sends diagnostic using stored client', async () => {
    const DI = loadSdk();
    DI.init({ apiKey: 'key', projectName: 'p' });
    DI.report(new TypeError('manual report'));
    await Promise.resolve();
    expect(fetch).toHaveBeenCalled();
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.mensagem).toBe('manual report');
    expect(body.contexto.project_name).toBe('p');
  });

  it('no-ops when init() was not called', async () => {
    const DI = loadSdk();
    DI.report(new Error('nothing'));
    await Promise.resolve();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('accepts explicit config override', async () => {
    const DI = loadSdk();
    DI.report(new Error('override'), {
      apiKey: 'override-key',
      projectName: 'override-proj',
      baseUrl: 'https://debug-assist.onrender.com',
    });
    await Promise.resolve();
    expect(fetch).toHaveBeenCalled();
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.contexto.project_name).toBe('override-proj');
  });
});
