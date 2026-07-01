\set ON_ERROR_STOP on

BEGIN;

-- Tabelas com prefixo socialbot evitam conflito com as tabelas internas do n8n.
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
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_socialbot_users_username_active
  ON socialbot_users(LOWER(username))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_socialbot_users_email_active
  ON socialbot_users(LOWER(email))
  WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_socialbot_users_active
  ON socialbot_users(active)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS socialbot_user_workspaces (
  user_id UUID NOT NULL REFERENCES socialbot_users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'operator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_socialbot_user_workspaces_workspace
  ON socialbot_user_workspaces(workspace_id);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_socialbot_sessions_token_hash
  ON socialbot_sessions(token_hash);

CREATE INDEX IF NOT EXISTS idx_socialbot_sessions_user_active
  ON socialbot_sessions(user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_socialbot_sessions_expiration
  ON socialbot_sessions(expires_at)
  WHERE revoked_at IS NULL;

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_socialbot_audit_log_user_created
  ON socialbot_audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_socialbot_audit_log_workspace_created
  ON socialbot_audit_log(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_socialbot_audit_log_entity
  ON socialbot_audit_log(entity_type, entity_id, created_at DESC);

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID;

ALTER TABLE post_events
  ADD COLUMN IF NOT EXISTS actor_user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'socialbot_users'::regclass
      AND conname = 'socialbot_users_role_check'
  ) THEN
    ALTER TABLE socialbot_users
      ADD CONSTRAINT socialbot_users_role_check
      CHECK (role IN ('admin', 'operator')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'socialbot_users'::regclass
      AND conname = 'socialbot_users_failed_login_attempts_check'
  ) THEN
    ALTER TABLE socialbot_users
      ADD CONSTRAINT socialbot_users_failed_login_attempts_check
      CHECK (failed_login_attempts >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'socialbot_user_workspaces'::regclass
      AND conname = 'socialbot_user_workspaces_role_check'
  ) THEN
    ALTER TABLE socialbot_user_workspaces
      ADD CONSTRAINT socialbot_user_workspaces_role_check
      CHECK (role IN ('admin', 'operator')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'socialbot_sessions'::regclass
      AND conname = 'socialbot_sessions_expiration_check'
  ) THEN
    ALTER TABLE socialbot_sessions
      ADD CONSTRAINT socialbot_sessions_expiration_check
      CHECK (expires_at > created_at) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'socialbot_audit_log'::regclass
      AND conname = 'socialbot_audit_log_details_object_check'
  ) THEN
    ALTER TABLE socialbot_audit_log
      ADD CONSTRAINT socialbot_audit_log_details_object_check
      CHECK (jsonb_typeof(details) = 'object') NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'posts'::regclass
      AND conname = 'posts_created_by_user_fk'
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_created_by_user_fk
      FOREIGN KEY (created_by_user_id)
      REFERENCES socialbot_users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'post_events'::regclass
      AND conname = 'post_events_actor_user_fk'
  ) THEN
    ALTER TABLE post_events
      ADD CONSTRAINT post_events_actor_user_fk
      FOREIGN KEY (actor_user_id)
      REFERENCES socialbot_users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

ALTER TABLE socialbot_users
  VALIDATE CONSTRAINT socialbot_users_role_check;
ALTER TABLE socialbot_users
  VALIDATE CONSTRAINT socialbot_users_failed_login_attempts_check;
ALTER TABLE socialbot_user_workspaces
  VALIDATE CONSTRAINT socialbot_user_workspaces_role_check;
ALTER TABLE socialbot_sessions
  VALIDATE CONSTRAINT socialbot_sessions_expiration_check;
ALTER TABLE socialbot_audit_log
  VALIDATE CONSTRAINT socialbot_audit_log_details_object_check;
ALTER TABLE posts VALIDATE CONSTRAINT posts_created_by_user_fk;
ALTER TABLE post_events VALIDATE CONSTRAINT post_events_actor_user_fk;

CREATE INDEX IF NOT EXISTS idx_posts_created_by_user
  ON posts(created_by_user_id)
  WHERE created_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_post_events_actor_user
  ON post_events(actor_user_id)
  WHERE actor_user_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_socialbot_users_updated_at'
      AND tgrelid = 'socialbot_users'::regclass
  ) THEN
    CREATE TRIGGER trg_socialbot_users_updated_at
    BEFORE UPDATE ON socialbot_users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_socialbot_user_workspaces_updated_at'
      AND tgrelid = 'socialbot_user_workspaces'::regclass
  ) THEN
    CREATE TRIGGER trg_socialbot_user_workspaces_updated_at
    BEFORE UPDATE ON socialbot_user_workspaces
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMIT;
