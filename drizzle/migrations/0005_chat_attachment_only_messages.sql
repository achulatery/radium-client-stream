ALTER TABLE public.app_chat_messages DROP CONSTRAINT app_chat_messages_body_check;
ALTER TABLE public.app_chat_messages ADD CONSTRAINT app_chat_messages_body_check CHECK (char_length(body) <= 2000);
CREATE INDEX IF NOT EXISTS app_uploads_message_id_idx ON public.app_uploads(message_id);