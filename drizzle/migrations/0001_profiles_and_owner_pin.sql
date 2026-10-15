ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS avatar text;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '';
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS pin_hash text;