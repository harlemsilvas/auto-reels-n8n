-- =========================================================
-- SOCIALBOT DATABASE STRUCTURE
-- PostgreSQL + Instagram Automation Platform
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =========================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- ENUMS
-- =========================================================

DO $$ BEGIN
    CREATE TYPE post_status AS ENUM (
        'pending',
        'scheduled',
        'queued',
        'processing',
        'uploading',
        'publishing',
        'published',
        'retrying',
        'error',
        'canceled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE storage_status AS ENUM (
        'local',
        'uploaded',
        'archived',
        'deleted',
        'error'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =========================================================
-- WORKSPACES
-- =========================================================

CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- =========================================================
-- INSTAGRAM ACCOUNTS
-- =========================================================

CREATE TABLE IF NOT EXISTS instagram_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,

    nome TEXT NOT NULL,
    instagram_id TEXT UNIQUE NOT NULL,
    page_id TEXT UNIQUE,

    access_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ,

    ativo BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- =========================================================
-- UPLOADS
-- =========================================================

CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,

    mime_type TEXT,
    file_size BIGINT,

    duration_seconds INTEGER,
    width INTEGER,
    height INTEGER,

    storage_path TEXT NOT NULL,

    storage_status storage_status NOT NULL DEFAULT 'local',

    checksum TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- =========================================================
-- POSTS
-- =========================================================

CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,

    account_id UUID NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,

    upload_id UUID REFERENCES uploads(id) ON DELETE SET NULL,

    video_filename TEXT,

    caption TEXT,

    hashtags TEXT[],

    source_path TEXT NOT NULL DEFAULT '/home/socialbot/media/reels/pending',

    media_size BIGINT,
    media_file_path TEXT,
    media_deleted_at TIMESTAMPTZ,

    publish_type TEXT NOT NULL DEFAULT 'reel',
    media_type TEXT,
    carousel_children JSONB NOT NULL DEFAULT '[]'::jsonb,
    cover_image_filename TEXT,
    publish_options JSONB NOT NULL DEFAULT '{}'::jsonb,

    scheduled_at TIMESTAMPTZ,

    publish_window_start TIMESTAMPTZ,
    publish_window_end TIMESTAMPTZ,

    timezone TEXT DEFAULT 'America/Sao_Paulo',

    best_time_score NUMERIC(5,2),

    published_at TIMESTAMPTZ,

    status post_status NOT NULL DEFAULT 'pending',

    meta_container_id TEXT,
    meta_media_id TEXT,

    error_message TEXT,

    retry_count INTEGER NOT NULL DEFAULT 0,

    last_retry_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,

    processing_started_at TIMESTAMPTZ,
    processing_finished_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'posts'::regclass
      AND conname = 'posts_publish_type_check'
  ) THEN
    ALTER TABLE posts
    ADD CONSTRAINT posts_publish_type_check
    CHECK (
      publish_type IN (
        'reel',
        'feed_image',
        'feed_carousel',
        'story_image',
        'story_video'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'posts'::regclass
      AND conname = 'posts_carousel_children_array_check'
  ) THEN
    ALTER TABLE posts
    ADD CONSTRAINT posts_carousel_children_array_check
    CHECK (jsonb_typeof(carousel_children) = 'array');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'posts'::regclass
      AND conname = 'posts_publish_options_object_check'
  ) THEN
    ALTER TABLE posts
    ADD CONSTRAINT posts_publish_options_object_check
    CHECK (jsonb_typeof(publish_options) = 'object');
  END IF;
END $$;

-- =========================================================
-- POST MEDIA ITEMS
-- =========================================================

CREATE TABLE IF NOT EXISTS post_media_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    media_kind TEXT NOT NULL CHECK (media_kind IN ('image', 'video')),
    stored_filename TEXT NOT NULL,
    original_filename TEXT,
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    file_size BIGINT CHECK (file_size IS NULL OR file_size >= 0),
    width INTEGER,
    height INTEGER,
    duration_seconds INTEGER,
    is_carousel_item BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT post_media_items_dimensions_check CHECK (
      (width IS NULL OR width > 0)
      AND (height IS NULL OR height > 0)
      AND (duration_seconds IS NULL OR duration_seconds >= 0)
    )
);

-- =========================================================
-- POST EVENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS post_events (
    id BIGSERIAL PRIMARY KEY,

    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

    event_type TEXT NOT NULL,

    details JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- POST METRICS / ANALYTICS
-- =========================================================

CREATE TABLE IF NOT EXISTS post_metrics (
    id BIGSERIAL PRIMARY KEY,

    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

    views INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    comments INTEGER NOT NULL DEFAULT 0,
    shares INTEGER NOT NULL DEFAULT 0,
    saved INTEGER NOT NULL DEFAULT 0,
    reach INTEGER NOT NULL DEFAULT 0,

    engagement_rate NUMERIC(10,2),

    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- FIXED SCHEDULE SLOTS
-- =========================================================

CREATE TABLE IF NOT EXISTS schedule_time_slots (
    id BIGSERIAL PRIMARY KEY,

    label TEXT NOT NULL,
    time_value TIME NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (time_value)
);

INSERT INTO schedule_time_slots (label, time_value, enabled, sort_order)
VALUES
    ('08:00', '08:00', true, 10),
    ('10:30', '10:30', true, 20),
    ('12:00', '12:00', true, 30),
    ('14:30', '14:30', true, 40),
    ('17:00', '17:00', true, 50),
    ('19:30', '19:30', true, 60),
    ('21:00', '21:00', true, 70)
ON CONFLICT (time_value) DO NOTHING;

-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_workspaces_ativo
ON workspaces(ativo);

CREATE INDEX IF NOT EXISTS idx_instagram_accounts_workspace_id
ON instagram_accounts(workspace_id);

CREATE INDEX IF NOT EXISTS idx_instagram_accounts_ativo
ON instagram_accounts(ativo);

CREATE INDEX IF NOT EXISTS idx_instagram_accounts_token_expires
ON instagram_accounts(token_expires_at);

CREATE INDEX IF NOT EXISTS idx_uploads_storage_status
ON uploads(storage_status);

CREATE INDEX IF NOT EXISTS idx_uploads_workspace_id
ON uploads(workspace_id);

CREATE INDEX IF NOT EXISTS idx_posts_workspace_id
ON posts(workspace_id);

CREATE INDEX IF NOT EXISTS idx_posts_account_id
ON posts(account_id);

CREATE INDEX IF NOT EXISTS idx_posts_upload_id
ON posts(upload_id);

CREATE INDEX IF NOT EXISTS idx_posts_status
ON posts(status);

CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at
ON posts(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_posts_published_at
ON posts(published_at);

CREATE INDEX IF NOT EXISTS idx_posts_next_retry_at
ON posts(next_retry_at);

CREATE INDEX IF NOT EXISTS idx_posts_created_at
ON posts(created_at);

CREATE INDEX IF NOT EXISTS idx_posts_publish_type
ON posts(publish_type);

CREATE INDEX IF NOT EXISTS idx_post_media_items_post_id
ON post_media_items(post_id);

CREATE INDEX IF NOT EXISTS idx_post_media_items_workspace_id
ON post_media_items(workspace_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_post_media_items_post_sort_active
ON post_media_items(post_id, sort_order)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_post_events_post_id
ON post_events(post_id);

CREATE INDEX IF NOT EXISTS idx_post_events_event_type
ON post_events(event_type);

CREATE INDEX IF NOT EXISTS idx_post_metrics_post_id
ON post_metrics(post_id);

CREATE INDEX IF NOT EXISTS idx_post_metrics_fetched_at
ON post_metrics(fetched_at);

CREATE INDEX IF NOT EXISTS idx_schedule_time_slots_enabled
ON schedule_time_slots(enabled);

CREATE INDEX IF NOT EXISTS idx_schedule_time_slots_sort_order
ON schedule_time_slots(sort_order);

-- =========================================================
-- TRIGGERS
-- =========================================================

DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON workspaces;

CREATE TRIGGER trg_workspaces_updated_at
BEFORE UPDATE ON workspaces
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_instagram_accounts_updated_at
ON instagram_accounts;

CREATE TRIGGER trg_instagram_accounts_updated_at
BEFORE UPDATE ON instagram_accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_uploads_updated_at
ON uploads;

CREATE TRIGGER trg_uploads_updated_at
BEFORE UPDATE ON uploads
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_posts_updated_at
ON posts;

CREATE TRIGGER trg_posts_updated_at
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_schedule_time_slots_updated_at
ON schedule_time_slots;

CREATE TRIGGER trg_schedule_time_slots_updated_at
BEFORE UPDATE ON schedule_time_slots
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
