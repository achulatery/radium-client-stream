CREATE TABLE public.app_site_settings (key text PRIMARY KEY, value jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.app_site_settings TO service_role;
ALTER TABLE public.app_site_settings ENABLE ROW LEVEL SECURITY;