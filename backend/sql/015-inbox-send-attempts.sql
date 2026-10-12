\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS public.instagram_send_attempts (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.instagram_conversations(id),
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  message_text TEXT NOT NULL CHECK (length(btrim(message_text)) > 0),
  recipient_id TEXT NOT NULL,
  sender_id TEXT,
  state TEXT NOT NULL DEFAULT 'sending'
    CHECK (state IN ('sending', 'sent', 'uncertain', 'rejected', 'dismissed')),
  meta_message_id TEXT,
  response JSONB,
  message_id UUID REFERENCES public.instagram_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_instagram_send_attempts_active
  ON public.instagram_send_attempts(conversation_id) WHERE state IN ('sending', 'uncertain');
CREATE INDEX IF NOT EXISTS idx_instagram_send_attempts_content
  ON public.instagram_send_attempts(conversation_id, content_hash, sent_at DESC)
  WHERE state = 'sent';
COMMIT;
