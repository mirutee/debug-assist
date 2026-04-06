-- supabase/migrations/20260403_fix_oauth_trigger.sql
-- Corrige o trigger OAuth para não fazer rollback do auth.users quando a inserção em usuarios falha.
-- Causa do bug: se NEW.email é NULL (email privado no GitHub) ou qualquer outra falha,
-- a exceção propagava e revertia o INSERT no auth.users, impedindo o login.

CREATE OR REPLACE FUNCTION public.handle_oauth_user_created()
RETURNS trigger AS $$
BEGIN
  IF NEW.confirmed_at IS NOT NULL
     AND (NEW.raw_app_meta_data->>'provider') IS DISTINCT FROM 'email' THEN
    BEGIN
      INSERT INTO public.usuarios (auth_id, email)
      VALUES (
        NEW.id,
        COALESCE(NEW.email, NEW.id::text || '@oauth.noreply')
      )
      ON CONFLICT (auth_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_oauth_user_created: falha ao criar perfil para auth_id=%, erro=%', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
