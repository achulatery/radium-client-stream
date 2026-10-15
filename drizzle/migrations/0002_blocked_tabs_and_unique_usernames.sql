ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS blocked_tabs text[] NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_lower_key ON public.app_users (lower(username));