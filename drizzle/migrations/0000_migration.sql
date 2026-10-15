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

CREATE TABLE public.app_account_roles (
  user_id uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','mod'))
);
GRANT ALL ON public.app_account_roles TO service_role;
ALTER TABLE public.app_account_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX app_chat_rooms_code ON public.app_chat_rooms (lower(code));
GRANT ALL ON public.app_chat_rooms TO service_role;
ALTER TABLE public.app_chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_room_members (
  room_id uuid NOT NULL REFERENCES public.app_chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
GRANT ALL ON public.app_room_members TO service_role;
ALTER TABLE public.app_room_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.app_chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by_role text CHECK (deleted_by_role IN ('self','mod','admin','owner'))
);
CREATE INDEX app_chat_messages_room_idx ON public.app_chat_messages(room_id, created_at DESC);
GRANT ALL ON public.app_chat_messages TO service_role;
ALTER TABLE public.app_chat_messages ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_users (username, password) VALUES ('Achulate', 'pbkdf2-sha256$fc534cfd205034cd8502beb02186abd3$65f1a906c079290454f9300ef6460519c621af35a19c79f9f41a841d6bf2cf0e');
INSERT INTO public.app_account_roles (user_id, role) SELECT id, 'owner' FROM public.app_users WHERE lower(username) = 'achulate';
INSERT INTO public.app_chat_rooms (code, name) VALUES ('general', 'general');