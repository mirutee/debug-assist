/**
 * @jest-environment jsdom
 */
'use strict';

// Mock React minimally — we test the class logic, not DOM rendering
// Variable must start with 'mock' to be referenceable inside jest.mock() factory
const mockReact = {
  Component: class Component {
    constructor(props) { this.props = props; this.state = {}; }
    setState(s) { Object.assign(this.state, s); }
  },
};
jest.mock('react', () => mockReact);

beforeEach(() => {
  jest.resetModules();
  jest.mock('react', () => mockReact);
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

afterEach(() => {
  window.onerror = null;
});

function loadBoundary() {
  const { ErrorBoundary } = require('../../sdk/browser/react.js');
  return ErrorBoundary;
}

describe('ErrorBoundary', () => {
  it('getDerivedStateFromError returns { hasError: true }', () => {
    const ErrorBoundary = loadBoundary();
    const state = ErrorBoundary.getDerivedStateFromError(new Error('test'));
    expect(state).toEqual({ hasError: true });
  });

  it('componentDidCatch sends diagnostic using global client', async () => {
    // Init the core SDK first to set the global client
    const DI = require('../../sdk/browser/devinsight.browser.js');
    DI.init({ apiKey: 'global-key', projectName: 'global-proj' });

    const ErrorBoundary = loadBoundary();
    const boundary = new ErrorBoundary({});
    boundary.componentDidCatch(new TypeError('render error'), {});
    await Promise.resolve();
    expect(fetch).toHaveBeenCalled();
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.tipo).toBe('silent_frontend_error');
    expect(body.mensagem).toBe('render error');
    expect(body.contexto.exception_type).toBe('TypeError');
  });

  it('componentDidCatch uses prop apiKey when provided', async () => {
    const ErrorBoundary = loadBoundary();
    const boundary = new ErrorBoundary({ apiKey: 'prop-key', projectName: 'prop-proj' });
    boundary.componentDidCatch(new Error('prop error'), {});
    await Promise.resolve();
    expect(fetch).toHaveBeenCalled();
    const authHeader = fetch.mock.calls[0][1].headers['Authorization'];
    expect(authHeader).toBe('Bearer prop-key');
  });

  it('silently drops diagnostic when no apiKey and no global init', async () => {
    // Do NOT call DI.init() — no global client
    const ErrorBoundary = loadBoundary();
    const boundary = new ErrorBoundary({});
    boundary.componentDidCatch(new Error('no key'), {});
    await Promise.resolve();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('prop apiKey takes precedence over global client', async () => {
    const DI = require('../../sdk/browser/devinsight.browser.js');
    DI.init({ apiKey: 'global-key', projectName: 'global' });

    const ErrorBoundary = loadBoundary();
    const boundary = new ErrorBoundary({ apiKey: 'prop-key', projectName: 'prop' });
    boundary.componentDidCatch(new Error('e'), {});
    await Promise.resolve();
    expect(fetch).toHaveBeenCalled();
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.contexto.project_name).toBe('prop');
  });
});
