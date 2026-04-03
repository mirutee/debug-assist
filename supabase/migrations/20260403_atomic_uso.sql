-- supabase/migrations/20260403_atomic_uso.sql
--
-- SEGURANÇA: Substitui o fluxo separado check(middleware) + increment(res.finish).
-- O antigo fluxo tinha TOCTOU: dois requests paralelos com uso_mensal=9 e limite=10
-- passavam ambos na verificação e incrementavam para 11, ultrapassando a cota.
--
-- Esta função faz check + increment em uma única transação atômica.
-- Retorna TRUE se o diagnóstico pode prosseguir (uso incrementado).
-- Retorna FALSE se o limite já foi atingido (uso NÃO incrementado).

CREATE OR REPLACE FUNCTION public.check_and_increment_uso_mensal(
  p_usuario_id uuid,
  p_limite     integer  -- -1 = ilimitado
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uso_atual integer;
BEGIN
  -- FOR UPDATE bloqueia a linha durante a transação, eliminando a race condition
  SELECT uso_mensal INTO v_uso_atual
    FROM public.usuarios
   WHERE id = p_usuario_id
     AND ativo = true
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- -1 = ilimitado
  IF p_limite <> -1 AND v_uso_atual >= p_limite THEN
    RETURN false;
  END IF;

  UPDATE public.usuarios
     SET uso_mensal = uso_mensal + 1
   WHERE id = p_usuario_id;

  RETURN true;
END;
$$;
