
BEGIN;

-- Criação de tabelas (se não existirem)
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id),
    external_message_id VARCHAR(255),
    sender_id VARCHAR(255),
    direction VARCHAR(20),
    message_type VARCHAR(20),
    message_text TEXT,
    raw_payload JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY,
  instagram_user_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS instagram_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES instagram_accounts(id) ON DELETE CASCADE,
    instagram_user_id TEXT NOT NULL,
    instagram_username TEXT,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_id, instagram_user_id)
);

CREATE TABLE IF NOT EXISTS instagram_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES instagram_conversations(id) ON DELETE CASCADE,
    meta_message_id TEXT UNIQUE,
    sender_id TEXT,
    recipient_id TEXT,
    message_text TEXT,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    sent_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_events (
    id BIGSERIAL PRIMARY KEY,
    provider TEXT NOT NULL,
    event_type TEXT,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Adição de colunas (se não existirem)
ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS facebook_user_id TEXT;
ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS account_type TEXT;
ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE instagram_conversations ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;
ALTER TABLE instagram_conversations ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS instagram_username TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Criação de índices
CREATE INDEX IF NOT EXISTS idx_instagram_conversations_account ON instagram_conversations(account_id);
CREATE INDEX IF NOT EXISTS idx_instagram_messages_conversation ON instagram_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_instagram_messages_meta_message ON instagram_messages(meta_message_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events(provider);

-- Atualização de dados (apenas se as colunas existirem)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='instagram_conversations' AND column_name='is_online') THEN
    UPDATE instagram_conversations SET is_online = true, last_seen_at = NOW();
  END IF;
END$$;

COMMIT;