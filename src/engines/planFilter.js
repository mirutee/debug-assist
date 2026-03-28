// src/engines/planFilter.js
function planFilter(resultado, plano_id) {
  if (plano_id === 'free') {
    const sugestoes = resultado.sugestoes || [];
    const extra = sugestoes.length - 1;
    return {
      ...resultado,
      sugestoes: sugestoes.slice(0, 1),
      ...(extra > 0
        ? { upgrade_hint: `Existem mais ${extra} sugestão(ões) disponível(is) no plano Pro.` }
        : {}),
    };
  }
  return resultado;
}

module.exports = planFilter;
