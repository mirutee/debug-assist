ALTER TABLE public.usuarios
  ADD COLUMN stripe_customer_id text UNIQUE;
