\set ON_ERROR_STOP on
BEGIN;
-- Oculta apenas na pagina Testers DM; preserva Inbox, mensagens e webhooks.
ALTER TABLE public.instagram_conversations
  ADD COLUMN IF NOT EXISTS testers_hidden_at TIMESTAMPTZ;
COMMIT;
