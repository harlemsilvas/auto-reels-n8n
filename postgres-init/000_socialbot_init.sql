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
-- SOCIALBOT ADMIN USERS / SESSIONS / AUDIT
-- Prefixo evita conflito com as tabelas internas do n8n.
-- =========================================================

CREATE TABLE IF NOT EXISTS socialbot_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    email TEXT,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    force_password_change BOOLEAN NOT NULL DEFAULT TRUE,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT socialbot_users_role_check
      CHECK (role IN ('admin', 'operator')),
    CONSTRAINT socialbot_users_failed_login_attempts_check
      CHECK (failed_login_attempts >= 0)
);

CREATE TABLE IF NOT EXISTS socialbot_user_workspaces (
    user_id UUID NOT NULL REFERENCES socialbot_users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'operator',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, workspace_id),
    CONSTRAINT socialbot_user_workspaces_role_check
      CHECK (role IN ('admin', 'operator'))
);

CREATE TABLE IF NOT EXISTS socialbot_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES socialbot_users(id) ON DELETE CASCADE,
    token_hash BYTEA NOT NULL,
    csrf_token_hash BYTEA NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT socialbot_sessions_expiration_check
      CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS socialbot_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES socialbot_users(id) ON DELETE SET NULL,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT socialbot_audit_log_details_object_check
      CHECK (jsonb_typeof(details) = 'object')
);

CREATE TABLE IF NOT EXISTS socialbot_oauth_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL
      REFERENCES socialbot_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL
      REFERENCES socialbot_users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'meta',
    state_hash BYTEA NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT socialbot_oauth_states_provider_check
      CHECK (provider IN ('meta')),
    CONSTRAINT socialbot_oauth_states_expiration_check
      CHECK (expires_at > created_at)
);

-- =========================================================
-- MEDIA TEMPLATES / AI TEXT VARIANTS
-- =========================================================

CREATE TABLE IF NOT EXISTS media_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'campaign',
    status TEXT NOT NULL DEFAULT 'draft',
    brand TEXT,
    product_name TEXT,
    base_description TEXT,
    target_audience TEXT,
    allowed_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
    forbidden_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
    default_cta TEXT,
    base_hashtags JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_by_user_id UUID REFERENCES socialbot_users(id) ON DELETE SET NULL,
    approved_by_user_id UUID REFERENCES socialbot_users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ,
    CONSTRAINT media_templates_tag_format_check CHECK (
      tag = LOWER(tag)
      AND tag ~ '^[a-z0-9][a-z0-9-]{1,119}$'
      AND tag !~ '--'
    ),
    CONSTRAINT media_templates_name_not_blank_check
      CHECK (LENGTH(BTRIM(name)) BETWEEN 1 AND 180),
    CONSTRAINT media_templates_category_not_blank_check
      CHECK (LENGTH(BTRIM(category)) BETWEEN 1 AND 60),
    CONSTRAINT media_templates_status_check
      CHECK (status IN ('draft', 'active', 'archived')),
    CONSTRAINT media_templates_claims_arrays_check CHECK (
      jsonb_typeof(allowed_claims) = 'array'
      AND jsonb_typeof(forbidden_claims) = 'array'
      AND jsonb_typeof(base_hashtags) = 'array'
    )
);

CREATE TABLE IF NOT EXISTS media_template_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES media_templates(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    media_kind TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'carousel_item',
    stored_filename TEXT NOT NULL,
    original_filename TEXT,
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    file_size BIGINT,
    width INTEGER,
    height INTEGER,
    duration_seconds INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT media_template_items_media_kind_check
      CHECK (media_kind IN ('image', 'video')),
    CONSTRAINT media_template_items_role_check
      CHECK (role IN ('hero', 'carousel_item', 'story', 'reel', 'cover', 'reference')),
    CONSTRAINT media_template_items_numbers_check CHECK (
      sort_order >= 0
      AND (file_size IS NULL OR file_size >= 0)
      AND (width IS NULL OR width > 0)
      AND (height IS NULL OR height > 0)
      AND (duration_seconds IS NULL OR duration_seconds >= 0)
    )
);

CREATE TABLE IF NOT EXISTS media_template_text_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES media_templates(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    publish_type TEXT NOT NULL,
    tone TEXT,
    objective TEXT,
    title TEXT,
    caption TEXT NOT NULL,
    hashtags JSONB NOT NULL DEFAULT '[]'::jsonb,
    cta TEXT,
    prompt_sent TEXT,
    ai_response TEXT,
    status TEXT NOT NULL DEFAULT 'generated',
    created_by_user_id UUID REFERENCES socialbot_users(id) ON DELETE SET NULL,
    approved_by_user_id UUID REFERENCES socialbot_users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT media_template_text_variants_publish_type_check CHECK (
      publish_type IN (
        'reel',
        'feed_image',
        'feed_carousel',
        'story_image',
        'story_video'
      )
    ),
    CONSTRAINT media_template_text_variants_status_check
      CHECK (status IN ('generated', 'approved', 'rejected')),
    CONSTRAINT media_template_text_variants_content_check CHECK (
      LENGTH(BTRIM(caption)) > 0
      AND jsonb_typeof(hashtags) = 'array'
    )
);

-- =========================================================
-- POSTS
-- =========================================================

CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,

    account_id UUID NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,

    upload_id UUID REFERENCES uploads(id) ON DELETE SET NULL,

    created_by_user_id UUID REFERENCES socialbot_users(id) ON DELETE SET NULL,

    media_template_id UUID REFERENCES media_templates(id) ON DELETE SET NULL,

    media_template_text_variant_id UUID REFERENCES media_template_text_variants(id) ON DELETE SET NULL,

    video_filename TEXT,

    title VARCHAR(160),

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

    CONSTRAINT posts_title_not_blank_check CHECK (
      title IS NULL OR LENGTH(BTRIM(title)) BETWEEN 1 AND 160
    ),

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

    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,

    actor_user_id UUID REFERENCES socialbot_users(id) ON DELETE SET NULL,

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

CREATE UNIQUE INDEX IF NOT EXISTS uq_media_templates_workspace_tag_active
ON media_templates(workspace_id, tag)
WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_media_templates_workspace_status
ON media_templates(workspace_id, status)
WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_media_templates_tag
ON media_templates(tag);

CREATE INDEX IF NOT EXISTS idx_media_templates_created_by_user
ON media_templates(created_by_user_id)
WHERE created_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_media_template_items_template
ON media_template_items(template_id);

CREATE INDEX IF NOT EXISTS idx_media_template_items_workspace
ON media_template_items(workspace_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_media_template_items_template_sort_active
ON media_template_items(template_id, sort_order)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_media_template_text_variants_template
ON media_template_text_variants(template_id);

CREATE INDEX IF NOT EXISTS idx_media_template_text_variants_workspace_status
ON media_template_text_variants(workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_media_template_text_variants_publish_type
ON media_template_text_variants(publish_type);

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

CREATE INDEX IF NOT EXISTS idx_posts_title
ON posts(title)
WHERE title IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_created_by_user
ON posts(created_by_user_id)
WHERE created_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_media_template_id
ON posts(media_template_id)
WHERE media_template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_media_template_text_variant_id
ON posts(media_template_text_variant_id)
WHERE media_template_text_variant_id IS NOT NULL;

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

CREATE INDEX IF NOT EXISTS idx_post_events_actor_user
ON post_events(actor_user_id)
WHERE actor_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_socialbot_users_username_active
ON socialbot_users(LOWER(username))
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_socialbot_users_email_active
ON socialbot_users(LOWER(email))
WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_socialbot_users_active
ON socialbot_users(active)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_socialbot_user_workspaces_workspace
ON socialbot_user_workspaces(workspace_id);

CREATE INDEX IF NOT EXISTS idx_socialbot_sessions_user_active
ON socialbot_sessions(user_id, expires_at)
WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_socialbot_sessions_token_hash
ON socialbot_sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_socialbot_sessions_expiration
ON socialbot_sessions(expires_at)
WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_socialbot_audit_log_user_created
ON socialbot_audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_socialbot_audit_log_workspace_created
ON socialbot_audit_log(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_socialbot_audit_log_entity
ON socialbot_audit_log(entity_type, entity_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_socialbot_oauth_states_hash
ON socialbot_oauth_states(state_hash);

CREATE INDEX IF NOT EXISTS idx_socialbot_oauth_states_session
ON socialbot_oauth_states(session_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_socialbot_oauth_states_active
ON socialbot_oauth_states(expires_at)
WHERE consumed_at IS NULL;

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

DROP TRIGGER IF EXISTS trg_socialbot_users_updated_at ON socialbot_users;

CREATE TRIGGER trg_socialbot_users_updated_at
BEFORE UPDATE ON socialbot_users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_socialbot_user_workspaces_updated_at
ON socialbot_user_workspaces;

CREATE TRIGGER trg_socialbot_user_workspaces_updated_at
BEFORE UPDATE ON socialbot_user_workspaces
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

DROP TRIGGER IF EXISTS trg_media_templates_updated_at
ON media_templates;

CREATE TRIGGER trg_media_templates_updated_at
BEFORE UPDATE ON media_templates
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_media_template_text_variants_updated_at
ON media_template_text_variants;

CREATE TRIGGER trg_media_template_text_variants_updated_at
BEFORE UPDATE ON media_template_text_variants
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
