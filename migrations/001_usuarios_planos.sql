-- migrations/001_usuarios_planos.sql
-- Executar no Supabase SQL Editor: https://supabase.com/dashboard/project/<seu-projeto>/sql

-- 1. Tabela de planos
CREATE TABLE IF NOT EXISTS public.planos (
  id             text PRIMARY KEY,
  nome           text NOT NULL,
  limite_mensal  integer NOT NULL,  -- -1 = ilimitado
  preco_brl      numeric(10,2)
);

INSERT INTO public.planos (id, nome, limite_mensal, preco_brl) VALUES
  ('free',       'Free',       100,    0),
  ('pro',        'Pro',        1000,   29.00),
  ('scale',      'Scale',      10000,  99.00),
  ('enterprise', 'Enterprise', -1,     NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. Tabela de usuários
CREATE TABLE IF NOT EXISTS public.usuarios (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id      uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text UNIQUE NOT NULL,
  api_key      uuid UNIQUE DEFAULT gen_random_uuid(),
  plano_id     text REFERENCES public.planos(id) DEFAULT 'free',
  uso_mensal   integer NOT NULL DEFAULT 0,
  ativo        boolean NOT NULL DEFAULT true,
  criado_em    timestamptz DEFAULT now()
);

-- 3. Função RPC para incremento atômico de uso
CREATE OR REPLACE FUNCTION public.increment_uso_mensal(p_usuario_id uuid)
RETURNS void AS $$
  UPDATE public.usuarios SET uso_mensal = uso_mensal + 1 WHERE id = p_usuario_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. Trigger: cria registro em usuarios APÓS confirmação de email
CREATE OR REPLACE FUNCTION public.handle_user_confirmed()
RETURNS trigger AS $$
BEGIN
  IF OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL THEN
    INSERT INTO public.usuarios (auth_id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (auth_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_confirmed();

-- 5. pg_cron: reset mensal (00:00 UTC do dia 1° = 21:00 BRT do último dia do mês)
-- ATENÇÃO: pg_cron precisa estar habilitado no projeto Supabase (Database > Extensions > pg_cron)
SELECT cron.schedule('reset-uso-mensal', '0 0 1 * *',
  'UPDATE public.usuarios SET uso_mensal = 0');
