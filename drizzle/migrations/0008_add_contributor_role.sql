ALTER TABLE public.app_account_roles DROP CONSTRAINT app_account_roles_role_check;
ALTER TABLE public.app_account_roles ADD CONSTRAINT app_account_roles_role_check CHECK (role IN ('owner','contributor','admin','mod'));
ALTER TABLE public.app_chat_messages DROP CONSTRAINT app_chat_messages_deleted_by_role_check;
ALTER TABLE public.app_chat_messages ADD CONSTRAINT app_chat_messages_deleted_by_role_check CHECK (deleted_by_role IN ('self','mod','admin','contributor','owner'));