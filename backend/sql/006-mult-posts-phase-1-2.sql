\set ON_ERROR_STOP on

BEGIN;

-- Fase 1: tipo e opcoes de publicacao.
-- O default reel mantem compatibilidade com todos os posts existentes.
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS publish_type TEXT NOT NULL DEFAULT 'reel',
  ADD COLUMN IF NOT EXISTS media_type TEXT,
  ADD COLUMN IF NOT EXISTS carousel_children JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cover_image_filename TEXT,
  ADD COLUMN IF NOT EXISTS publish_options JSONB NOT NULL DEFAULT '{}'::jsonb;

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
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'posts'::regclass
      AND conname = 'posts_carousel_children_array_check'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_carousel_children_array_check
      CHECK (jsonb_typeof(carousel_children) = 'array') NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'posts'::regclass
      AND conname = 'posts_publish_options_object_check'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_publish_options_object_check
      CHECK (jsonb_typeof(publish_options) = 'object') NOT VALID;
  END IF;
END $$;

ALTER TABLE posts VALIDATE CONSTRAINT posts_publish_type_check;
ALTER TABLE posts VALIDATE CONSTRAINT posts_carousel_children_array_check;
ALTER TABLE posts VALIDATE CONSTRAINT posts_publish_options_object_check;

CREATE INDEX IF NOT EXISTS idx_posts_publish_type
  ON posts(publish_type);

-- Fase 2: itens de midia normalizados.
CREATE TABLE IF NOT EXISTS post_media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  media_kind TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  original_filename TEXT,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  is_carousel_item BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'post_media_items'::regclass
      AND conname = 'post_media_items_media_kind_check'
  ) THEN
    ALTER TABLE post_media_items
      ADD CONSTRAINT post_media_items_media_kind_check
      CHECK (media_kind IN ('image', 'video')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'post_media_items'::regclass
      AND conname = 'post_media_items_sort_order_check'
  ) THEN
    ALTER TABLE post_media_items
      ADD CONSTRAINT post_media_items_sort_order_check
      CHECK (sort_order >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'post_media_items'::regclass
      AND conname = 'post_media_items_file_size_check'
  ) THEN
    ALTER TABLE post_media_items
      ADD CONSTRAINT post_media_items_file_size_check
      CHECK (file_size IS NULL OR file_size >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'post_media_items'::regclass
      AND conname = 'post_media_items_dimensions_check'
  ) THEN
    ALTER TABLE post_media_items
      ADD CONSTRAINT post_media_items_dimensions_check
      CHECK (
        (width IS NULL OR width > 0)
        AND (height IS NULL OR height > 0)
        AND (duration_seconds IS NULL OR duration_seconds >= 0)
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE post_media_items
  VALIDATE CONSTRAINT post_media_items_media_kind_check;
ALTER TABLE post_media_items
  VALIDATE CONSTRAINT post_media_items_sort_order_check;
ALTER TABLE post_media_items
  VALIDATE CONSTRAINT post_media_items_file_size_check;
ALTER TABLE post_media_items
  VALIDATE CONSTRAINT post_media_items_dimensions_check;

CREATE INDEX IF NOT EXISTS idx_post_media_items_post_id
  ON post_media_items(post_id);

CREATE INDEX IF NOT EXISTS idx_post_media_items_workspace_id
  ON post_media_items(workspace_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_post_media_items_post_sort_active
  ON post_media_items(post_id, sort_order)
  WHERE deleted_at IS NULL;

COMMIT;
