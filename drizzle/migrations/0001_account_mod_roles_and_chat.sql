CREATE TABLE public.app_account_roles (
 user_id uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('owner','mod'))
);
GRANT ALL ON public.app_account_roles TO service_role;
ALTER TABLE public.app_account_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Server manages account roles" ON public.app_account_roles FOR ALL TO service_role USING (true) WITH CHECK (true);
INSERT INTO public.app_account_roles (user_id, role) SELECT id, CASE WHEN lower(username) = 'achulate' THEN 'owner' ELSE 'mod' END FROM public.app_users WHERE is_admin = true;
COMMENT ON COLUMN public.app_users.is_admin IS 'DEPRECATED: authorization uses app_account_roles; retained for compatibility with older deployments';
CREATE TABLE public.app_chat_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
 body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_chat_messages TO service_role;
ALTER TABLE public.app_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Server manages signed-in chat" ON public.app_chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX app_chat_messages_created_idx ON public.app_chat_messages(created_at DESC);