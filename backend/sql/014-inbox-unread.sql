\set ON_ERROR_STOP on
BEGIN;
-- Historico anterior tem estado de leitura desconhecido; nao gera badge retroativo.
ALTER TABLE public.instagram_messages
  ADD COLUMN IF NOT EXISTS inbox_unread BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_instagram_messages_inbox_unread
  ON public.instagram_messages (conversation_id) WHERE inbox_unread = TRUE;
COMMIT;
