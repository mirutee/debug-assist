-- migrations/002_rls.sql
-- Habilita Row Level Security (RLS) nas tabelas principais.
-- O backend usa a SUPABASE_KEY do tipo service_role, que sempre bypassa RLS.
-- Habilitar RLS sem políticas bloqueia qualquer acesso de anon/authenticated roles,
-- garantindo que nenhum cliente direto (ou key vazada de menor privilégio) acesse os dados.
-- Executar no Supabase SQL Editor: https://supabase.com/dashboard/project/<seu-projeto>/sql

ALTER TABLE public.usuarios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnosticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planos      ENABLE ROW LEVEL SECURITY;

-- planos: leitura pública (não contém dados sensíveis)
CREATE POLICY "planos_select_all"
  ON public.planos FOR SELECT
  USING (true);
