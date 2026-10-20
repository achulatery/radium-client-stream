ALTER TABLE public.app_chat_rooms ADD COLUMN IF NOT EXISTS read_only boolean NOT NULL DEFAULT false;
INSERT INTO public.app_chat_rooms (code, name, is_public, read_only, created_at)
SELECT 'announcements', 'Announcements', true, true, '2000-01-01T00:00:00Z'
WHERE NOT EXISTS (SELECT 1 FROM public.app_chat_rooms WHERE code = 'announcements');
INSERT INTO public.app_chat_rooms (code, name, is_public, read_only, created_at)
SELECT 'updates', 'Updates', true, true, '2000-01-01T00:00:01Z'
WHERE NOT EXISTS (SELECT 1 FROM public.app_chat_rooms WHERE code = 'updates');
UPDATE public.app_chat_rooms SET read_only = true, is_public = true WHERE code IN ('announcements','updates');