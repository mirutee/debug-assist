-- supabase/migrations/20260329_oauth_trigger.sql
-- OAuth users (GitHub, etc.) are created with confirmed_at already set on INSERT.
-- The existing UPDATE trigger does not fire for them.
-- This trigger creates the usuarios record for any OAuth user on signup.

CREATE OR REPLACE FUNCTION public.handle_oauth_user_created()
RETURNS trigger AS $$
BEGIN
  IF NEW.confirmed_at IS NOT NULL
     AND (NEW.raw_app_meta_data->>'provider') IS DISTINCT FROM 'email' THEN
    INSERT INTO public.usuarios (auth_id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (auth_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_oauth_user_created ON auth.users;
CREATE TRIGGER on_oauth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_oauth_user_created();
