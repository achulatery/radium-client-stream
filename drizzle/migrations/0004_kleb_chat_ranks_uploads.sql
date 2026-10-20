CREATE TABLE public.app_extras (user_id uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE, chat_rank text CHECK (chat_rank IN ('vip','mvp','mythic','legend','radium')), kleb_enabled boolean NOT NULL DEFAULT false, kleb_title text NOT NULL DEFAULT 'Kleb', kleb_body text NOT NULL DEFAULT '', kleb_layout text NOT NULL DEFAULT 'grid' CHECK (kleb_layout IN ('grid','list')));
GRANT ALL ON public.app_extras TO service_role;
ALTER TABLE public.app_extras ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.app_uploads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE, room_id uuid REFERENCES public.app_chat_rooms(id) ON DELETE CASCADE, kind text NOT NULL CHECK (kind IN ('chat','kleb')), name text NOT NULL, mime text NOT NULL, size_bytes bigint NOT NULL CHECK (size_bytes > 0), chunk_count integer NOT NULL, complete boolean NOT NULL DEFAULT false, message_id uuid REFERENCES public.app_chat_messages(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.app_uploads TO service_role;
ALTER TABLE public.app_uploads ENABLE ROW LEVEL SECURITY;
CREATE INDEX app_uploads_owner_kind ON public.app_uploads(user_id, kind);
CREATE OR REPLACE FUNCTION public.reserve_radium_upload(p_id uuid, p_user uuid, p_room uuid, p_kind text, p_name text, p_mime text, p_size bigint, p_chunks integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
PERFORM 1 FROM public.app_users WHERE id = p_user FOR UPDATE;
IF p_kind = 'kleb' AND (SELECT coalesce(sum(size_bytes),0) FROM public.app_uploads WHERE user_id = p_user AND kind = 'kleb') + p_size > 5000000000 THEN RAISE EXCEPTION 'Kleb picture storage limit reached'; END IF;
INSERT INTO public.app_uploads(id,user_id,room_id,kind,name,mime,size_bytes,chunk_count) VALUES(p_id,p_user,p_room,p_kind,p_name,p_mime,p_size,p_chunks);
END $$;
REVOKE ALL ON FUNCTION public.reserve_radium_upload(uuid,uuid,uuid,text,text,text,bigint,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_radium_upload(uuid,uuid,uuid,text,text,text,bigint,integer) TO service_role;