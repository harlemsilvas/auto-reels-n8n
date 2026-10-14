\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.socialbot_privacy_scope_blocks (
  scope_key TEXT PRIMARY KEY CHECK (scope_key ~ '^[a-f0-9]{64}$'),
  request_id UUID NOT NULL UNIQUE REFERENCES public.socialbot_deletion_requests(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.socialbot_deletion_files (
  request_id UUID NOT NULL REFERENCES public.socialbot_deletion_requests(id),
  filename TEXT NOT NULL CHECK (filename ~ '^[a-f0-9-]{36}\.(jpg|png)$'),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','quarantined','removed','shared')),
  device TEXT,
  inode TEXT,
  PRIMARY KEY(request_id,filename)
);
CREATE TABLE IF NOT EXISTS public.socialbot_privacy_operations (
  id UUID PRIMARY KEY,
  scope_key TEXT NOT NULL CHECK (scope_key ~ '^[a-f0-9]{64}$'),
  kind TEXT NOT NULL CHECK (kind IN ('text','image','quick_replies')),
  state TEXT NOT NULL CHECK (state IN ('sending','uncertain','succeeded','rejected')),
  filename TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_socialbot_privacy_operations_scope ON public.socialbot_privacy_operations(scope_key);
CREATE OR REPLACE FUNCTION public.socialbot_privacy_scope_key(account UUID, subject TEXT)
RETURNS TEXT LANGUAGE SQL IMMUTABLE STRICT AS $$
  SELECT encode(digest(account::text || chr(10) || subject,'sha256'),'hex')
$$;
CREATE OR REPLACE FUNCTION public.socialbot_privacy_write_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account UUID; subject TEXT; key TEXT; old_account UUID; old_subject TEXT; old_key TEXT;
BEGIN
  IF TG_TABLE_NAME='instagram_conversations' THEN
    account := NEW.account_id; subject := NEW.instagram_user_id;
  ELSE
    SELECT c.account_id,c.instagram_user_id INTO account,subject
      FROM public.instagram_conversations c WHERE c.id=NEW.conversation_id;
    IF account IS NULL THEN RAISE EXCEPTION 'PRIVACY_CONVERSATION_NOT_FOUND'; END IF;
  END IF;
  key := public.socialbot_privacy_scope_key(account,subject);
  IF TG_OP='UPDATE' THEN
    IF TG_TABLE_NAME='instagram_conversations' THEN old_account:=OLD.account_id;old_subject:=OLD.instagram_user_id;
    ELSE SELECT c.account_id,c.instagram_user_id INTO old_account,old_subject
      FROM public.instagram_conversations c WHERE c.id=OLD.conversation_id; END IF;
    old_key:=public.socialbot_privacy_scope_key(old_account,old_subject);
    PERFORM pg_advisory_xact_lock_shared(hashtextextended(old_key,0));
    IF EXISTS(SELECT 1 FROM public.socialbot_privacy_scope_blocks b WHERE b.scope_key=old_key) THEN
      RAISE EXCEPTION 'PRIVACY_SCOPE_BLOCKED';
    END IF;
  END IF;
  PERFORM pg_advisory_xact_lock_shared(hashtextextended(key,0));
  IF EXISTS(SELECT 1 FROM public.socialbot_privacy_scope_blocks b WHERE b.scope_key=key) THEN
    RAISE EXCEPTION 'PRIVACY_SCOPE_BLOCKED';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS socialbot_privacy_conversation_guard ON public.instagram_conversations;
CREATE TRIGGER socialbot_privacy_conversation_guard BEFORE INSERT OR UPDATE ON public.instagram_conversations
FOR EACH ROW EXECUTE FUNCTION public.socialbot_privacy_write_guard();
DROP TRIGGER IF EXISTS socialbot_privacy_message_guard ON public.instagram_messages;
CREATE TRIGGER socialbot_privacy_message_guard BEFORE INSERT OR UPDATE ON public.instagram_messages
FOR EACH ROW EXECUTE FUNCTION public.socialbot_privacy_write_guard();
DROP TRIGGER IF EXISTS socialbot_privacy_attempt_guard ON public.instagram_send_attempts;
CREATE TRIGGER socialbot_privacy_attempt_guard BEFORE INSERT OR UPDATE ON public.instagram_send_attempts
FOR EACH ROW EXECUTE FUNCTION public.socialbot_privacy_write_guard();
COMMIT;
