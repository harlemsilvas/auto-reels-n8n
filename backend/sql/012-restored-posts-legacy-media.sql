\set ON_ERROR_STOP on
BEGIN;
-- Alinha a cópia restaurada às colunas legadas do bootstrap atual.
-- Não modifica registros existentes nem obriga backfill.
ALTER TABLE posts
 ADD COLUMN IF NOT EXISTS video_filename TEXT,
 ADD COLUMN IF NOT EXISTS media_size BIGINT,
 ADD COLUMN IF NOT EXISTS media_file_path TEXT,
 ADD COLUMN IF NOT EXISTS media_deleted_at TIMESTAMPTZ;
COMMIT;
