BEGIN;

CREATE TABLE IF NOT EXISTS instagram_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    conversation_id UUID NOT NULL,

    sender_id TEXT,

    recipient_id TEXT,

    sender_type TEXT NOT NULL,

    message_text TEXT,

    meta_message_id TEXT,

    payload JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_instagram_messages_conversation_id
ON instagram_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_instagram_messages_created_at
ON instagram_messages(created_at);

COMMIT;
