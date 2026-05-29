BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS instagram_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    account_id UUID NOT NULL,

    instagram_user_id TEXT NOT NULL,

    instagram_username TEXT,

    instagram_name TEXT,

    profile_picture_url TEXT,

    last_message_text TEXT,

    last_message_at TIMESTAMPTZ,

    unread_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_instagram_conversations_account_id
ON instagram_conversations(account_id);

CREATE INDEX IF NOT EXISTS idx_instagram_conversations_instagram_user_id
ON instagram_conversations(instagram_user_id);

COMMIT;

