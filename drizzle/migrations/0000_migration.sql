CREATE TABLE public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  password text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  banned boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX app_users_username_lower ON public.app_users (lower(username));
GRANT ALL ON public.app_users TO service_role;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  value text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_activity_user ON public.app_activity (user_id, created_at DESC);
GRANT ALL ON public.app_activity TO service_role;
ALTER TABLE public.app_activity ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_users (username, password, is_admin) VALUES ('Achulate', '89250013', true);