-- Add AI key encryption and provider columns to usuarios table
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS ai_key_encrypted text,
  ADD COLUMN IF NOT EXISTS ai_provider text;
