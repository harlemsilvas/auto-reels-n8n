\set ON_ERROR_STOP on

BEGIN;

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
  archived_at TIMESTAMPTZ
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
  deleted_at TIMESTAMPTZ
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS media_template_id UUID,
  ADD COLUMN IF NOT EXISTS media_template_text_variant_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'media_templates'::regclass
      AND conname = 'media_templates_tag_format_check'
  ) THEN
    ALTER TABLE media_templates
      ADD CONSTRAINT media_templates_tag_format_check
      CHECK (
        tag = LOWER(tag)
        AND tag ~ '^[a-z0-9][a-z0-9-]{1,119}$'
        AND tag !~ '--'
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'media_templates'::regclass
      AND conname = 'media_templates_name_not_blank_check'
  ) THEN
    ALTER TABLE media_templates
      ADD CONSTRAINT media_templates_name_not_blank_check
      CHECK (LENGTH(BTRIM(name)) BETWEEN 1 AND 180) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'media_templates'::regclass
      AND conname = 'media_templates_category_not_blank_check'
  ) THEN
    ALTER TABLE media_templates
      ADD CONSTRAINT media_templates_category_not_blank_check
      CHECK (LENGTH(BTRIM(category)) BETWEEN 1 AND 60) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'media_templates'::regclass
      AND conname = 'media_templates_status_check'
  ) THEN
    ALTER TABLE media_templates
      ADD CONSTRAINT media_templates_status_check
      CHECK (status IN ('draft', 'active', 'archived')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'media_templates'::regclass
      AND conname = 'media_templates_claims_arrays_check'
  ) THEN
    ALTER TABLE media_templates
      ADD CONSTRAINT media_templates_claims_arrays_check
      CHECK (
        jsonb_typeof(allowed_claims) = 'array'
        AND jsonb_typeof(forbidden_claims) = 'array'
        AND jsonb_typeof(base_hashtags) = 'array'
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'media_template_items'::regclass
      AND conname = 'media_template_items_media_kind_check'
  ) THEN
    ALTER TABLE media_template_items
      ADD CONSTRAINT media_template_items_media_kind_check
      CHECK (media_kind IN ('image', 'video')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'media_template_items'::regclass
      AND conname = 'media_template_items_role_check'
  ) THEN
    ALTER TABLE media_template_items
      ADD CONSTRAINT media_template_items_role_check
      CHECK (role IN ('hero', 'carousel_item', 'story', 'reel', 'cover', 'reference')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'media_template_items'::regclass
      AND conname = 'media_template_items_numbers_check'
  ) THEN
    ALTER TABLE media_template_items
      ADD CONSTRAINT media_template_items_numbers_check
      CHECK (
        sort_order >= 0
        AND (file_size IS NULL OR file_size >= 0)
        AND (width IS NULL OR width > 0)
        AND (height IS NULL OR height > 0)
        AND (duration_seconds IS NULL OR duration_seconds >= 0)
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'media_template_text_variants'::regclass
      AND conname = 'media_template_text_variants_publish_type_check'
  ) THEN
    ALTER TABLE media_template_text_variants
      ADD CONSTRAINT media_template_text_variants_publish_type_check
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
    WHERE conrelid = 'media_template_text_variants'::regclass
      AND conname = 'media_template_text_variants_status_check'
  ) THEN
    ALTER TABLE media_template_text_variants
      ADD CONSTRAINT media_template_text_variants_status_check
      CHECK (status IN ('generated', 'approved', 'rejected')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'media_template_text_variants'::regclass
      AND conname = 'media_template_text_variants_content_check'
  ) THEN
    ALTER TABLE media_template_text_variants
      ADD CONSTRAINT media_template_text_variants_content_check
      CHECK (
        LENGTH(BTRIM(caption)) > 0
        AND jsonb_typeof(hashtags) = 'array'
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'posts'::regclass
      AND conname = 'posts_media_template_fk'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_media_template_fk
      FOREIGN KEY (media_template_id)
      REFERENCES media_templates(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'posts'::regclass
      AND conname = 'posts_media_template_text_variant_fk'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_media_template_text_variant_fk
      FOREIGN KEY (media_template_text_variant_id)
      REFERENCES media_template_text_variants(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

ALTER TABLE media_templates VALIDATE CONSTRAINT media_templates_tag_format_check;
ALTER TABLE media_templates VALIDATE CONSTRAINT media_templates_name_not_blank_check;
ALTER TABLE media_templates VALIDATE CONSTRAINT media_templates_category_not_blank_check;
ALTER TABLE media_templates VALIDATE CONSTRAINT media_templates_status_check;
ALTER TABLE media_templates VALIDATE CONSTRAINT media_templates_claims_arrays_check;
ALTER TABLE media_template_items VALIDATE CONSTRAINT media_template_items_media_kind_check;
ALTER TABLE media_template_items VALIDATE CONSTRAINT media_template_items_role_check;
ALTER TABLE media_template_items VALIDATE CONSTRAINT media_template_items_numbers_check;
ALTER TABLE media_template_text_variants VALIDATE CONSTRAINT media_template_text_variants_publish_type_check;
ALTER TABLE media_template_text_variants VALIDATE CONSTRAINT media_template_text_variants_status_check;
ALTER TABLE media_template_text_variants VALIDATE CONSTRAINT media_template_text_variants_content_check;
ALTER TABLE posts VALIDATE CONSTRAINT posts_media_template_fk;
ALTER TABLE posts VALIDATE CONSTRAINT posts_media_template_text_variant_fk;

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

CREATE INDEX IF NOT EXISTS idx_posts_media_template_id
  ON posts(media_template_id)
  WHERE media_template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_media_template_text_variant_id
  ON posts(media_template_text_variant_id)
  WHERE media_template_text_variant_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_media_templates_updated_at ON media_templates;

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

COMMIT;
