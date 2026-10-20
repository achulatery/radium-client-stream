CREATE TABLE public.app_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('announcement', 'update')),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  author_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_posts TO service_role;
ALTER TABLE public.app_posts ENABLE ROW LEVEL SECURITY;