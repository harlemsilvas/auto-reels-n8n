-- Correcao incremental de schema para ambientes que subiram com estrutura antiga.
-- Seguro para executar mais de uma vez (idempotente).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- 1) workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Garante ao menos 1 workspace padrao
INSERT INTO workspaces (nome, ativo)
SELECT 'Workspace Padrao', true
WHERE NOT EXISTS (
  SELECT 1 FROM workspaces WHERE deleted_at IS NULL
);

-- 2) instagram_accounts (colunas esperadas no backend atual)
ALTER TABLE instagram_accounts
  ADD COLUMN IF NOT EXISTS workspace_id UUID,
  ADD COLUMN IF NOT EXISTS page_id TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Backfill workspace_id para contas antigas sem workspace
UPDATE instagram_accounts ia
SET workspace_id = w.id
FROM (
  SELECT id
  FROM workspaces
  WHERE deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1
) w
WHERE ia.workspace_id IS NULL;

-- FK workspace_id -> workspaces(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'instagram_accounts_workspace_id_fkey'
  ) THEN
    ALTER TABLE instagram_accounts
    ADD CONSTRAINT instagram_accounts_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Trigger updated_at na tabela instagram_accounts
DROP TRIGGER IF EXISTS trg_instagram_accounts_updated_at ON instagram_accounts;
CREATE TRIGGER trg_instagram_accounts_updated_at
BEFORE UPDATE ON instagram_accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- 3) posts.workspace_id (evita proximo erro em cadeia)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS upload_id UUID,
  ADD COLUMN IF NOT EXISTS caption TEXT,
  ADD COLUMN IF NOT EXISTS source_path TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meta_container_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_media_id TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_finished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS workspace_id UUID,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'posts'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE posts ADD COLUMN status post_status NOT NULL DEFAULT 'pending';
  END IF;
END $$;

UPDATE posts p
SET workspace_id = ia.workspace_id
FROM instagram_accounts ia
WHERE p.account_id = ia.id
  AND p.workspace_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_workspace_id_fkey'
  ) THEN
    ALTER TABLE posts
    ADD CONSTRAINT posts_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4) uploads (colunas usadas no listPosts)
ALTER TABLE uploads
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS stored_filename TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS storage_status storage_status NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE uploads
SET original_filename = COALESCE(original_filename, stored_filename, 'arquivo.mp4')
WHERE original_filename IS NULL;

UPDATE uploads
SET stored_filename = COALESCE(stored_filename, original_filename, 'arquivo.mp4')
WHERE stored_filename IS NULL;

UPDATE uploads
SET storage_path = COALESCE(storage_path, '/home/socialbot/media/reels/pending')
WHERE storage_path IS NULL;

DROP TRIGGER IF EXISTS trg_posts_updated_at ON posts;
CREATE TRIGGER trg_posts_updated_at
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_uploads_updated_at ON uploads;
CREATE TRIGGER trg_uploads_updated_at
BEFORE UPDATE ON uploads
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
