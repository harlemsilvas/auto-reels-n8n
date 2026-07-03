\set ON_ERROR_STOP on

BEGIN;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS title VARCHAR(160);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'posts'::regclass
      AND conname = 'posts_title_not_blank_check'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_title_not_blank_check
      CHECK (
        title IS NULL
        OR LENGTH(BTRIM(title)) BETWEEN 1 AND 160
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE posts
  VALIDATE CONSTRAINT posts_title_not_blank_check;

CREATE INDEX IF NOT EXISTS idx_posts_title
  ON posts(title)
  WHERE title IS NOT NULL;

COMMIT;
