\set ON_ERROR_STOP on
DO $$
BEGIN
  IF to_regclass('public.socialbot_privacy_scope_blocks') IS NULL OR
    to_regclass('public.socialbot_privacy_operations') IS NULL OR
    to_regclass('public.socialbot_deletion_files') IS NULL THEN RAISE EXCEPTION 'Schema 017 ausente'; END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgrelid IN
    ('public.instagram_conversations'::regclass,'public.instagram_messages'::regclass,'public.instagram_send_attempts'::regclass)
    AND tgname IN ('socialbot_privacy_conversation_guard','socialbot_privacy_message_guard','socialbot_privacy_attempt_guard')
    AND tgenabled='O' AND tgfoid='public.socialbot_privacy_write_guard()'::regprocedure) <> 3 THEN
    RAISE EXCEPTION 'Triggers 017 invalidos';
  END IF;
  IF public.socialbot_privacy_scope_key('00000000-0000-4000-8000-000000000000','demo') <>
    encode(digest('00000000-0000-4000-8000-000000000000'||chr(10)||'demo','sha256'),'hex') THEN
    RAISE EXCEPTION 'Chave de escopo invalida';
  END IF;
END $$;
