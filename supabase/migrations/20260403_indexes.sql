-- supabase/migrations/20260403_indexes.sql
--
-- SEGURANÇA/PERFORMANCE: Índices em colunas de filtragem crítica.
-- Sem índices, cada query faz full table scan — com volume cresce para DoS.
--
-- CONCURRENTLY: não bloqueia leitura/escrita durante criação do índice.
-- Nota: CONCURRENTLY não pode rodar dentro de uma transação explícita.

-- Diagnósticos: filtrados por usuario_id em todas as queries de histórico e analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_diagnosticos_usuario_id
  ON public.diagnosticos (usuario_id);

-- Diagnósticos: ordenados por criado_em DESC em histórico — índice composto otimiza
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_diagnosticos_usuario_criado
  ON public.diagnosticos (usuario_id, criado_em DESC);

-- Usuários: stripe_customer_id buscado em todos os webhooks de billing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usuarios_stripe_customer_id
  ON public.usuarios (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
