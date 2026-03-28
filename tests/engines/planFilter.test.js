// tests/engines/planFilter.test.js
const planFilter = require('../../src/engines/planFilter');

const base = {
  problema: 'Erro de hidratação',
  causa: 'Date.now() no render',
  nivel: 'alto',
  categoria: 'frontend',
  confianca: 0.97,
  sugestoes: ['Sugestão 1', 'Sugestão 2', 'Sugestão 3'],
};

describe('planFilter', () => {
  it('free: retorna apenas 1 sugestão', () => {
    const r = planFilter(base, 'free');
    expect(r.sugestoes).toHaveLength(1);
    expect(r.sugestoes[0]).toBe('Sugestão 1');
  });

  it('free: adiciona upgrade_hint quando há mais sugestões', () => {
    const r = planFilter(base, 'free');
    expect(r.upgrade_hint).toBeDefined();
    expect(r.upgrade_hint).toContain('2');
  });

  it('free: não adiciona upgrade_hint com apenas 1 sugestão', () => {
    const r = planFilter({ ...base, sugestoes: ['Apenas uma'] }, 'free');
    expect(r.upgrade_hint).toBeUndefined();
  });

  it('free: mantém problema, causa, nivel, confianca intactos', () => {
    const r = planFilter(base, 'free');
    expect(r.problema).toBe(base.problema);
    expect(r.causa).toBe(base.causa);
    expect(r.nivel).toBe(base.nivel);
    expect(r.confianca).toBe(base.confianca);
  });

  it('pro: retorna todas as sugestões sem upgrade_hint', () => {
    const r = planFilter(base, 'pro');
    expect(r.sugestoes).toHaveLength(3);
    expect(r.upgrade_hint).toBeUndefined();
  });

  it('scale: retorna todas as sugestões sem upgrade_hint', () => {
    const r = planFilter(base, 'scale');
    expect(r.sugestoes).toHaveLength(3);
    expect(r.upgrade_hint).toBeUndefined();
  });

  it('enterprise: retorna todas as sugestões sem upgrade_hint', () => {
    const r = planFilter(base, 'enterprise');
    expect(r.sugestoes).toHaveLength(3);
    expect(r.upgrade_hint).toBeUndefined();
  });

  it('free: sugestoes vazio não quebra', () => {
    const r = planFilter({ ...base, sugestoes: [] }, 'free');
    expect(r.sugestoes).toHaveLength(0);
    expect(r.upgrade_hint).toBeUndefined();
  });
});
