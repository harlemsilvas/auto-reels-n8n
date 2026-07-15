\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS ai_provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  task TEXT NOT NULL DEFAULT 'media_templates_text',
  model TEXT NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  api_key_hint TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  priority INTEGER NOT NULL DEFAULT 100,
  daily_limit INTEGER,
  minute_limit INTEGER,
  last_used_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id UUID REFERENCES socialbot_users(id) ON DELETE SET NULL,
  updated_by_user_id UUID REFERENCES socialbot_users(id) ON DELETE SET NULL,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_provider_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID REFERENCES ai_provider_credentials(id) ON DELETE SET NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  task TEXT NOT NULL,
  model TEXT,
  event_type TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  error_code TEXT,
  error_message TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'ai_provider_credentials'::regclass
      AND conname = 'ai_provider_credentials_provider_check'
  ) THEN
    ALTER TABLE ai_provider_credentials
      ADD CONSTRAINT ai_provider_credentials_provider_check
      CHECK (provider IN ('gemini')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'ai_provider_credentials'::regclass
      AND conname = 'ai_provider_credentials_label_check'
  ) THEN
    ALTER TABLE ai_provider_credentials
      ADD CONSTRAINT ai_provider_credentials_label_check
      CHECK (LENGTH(BTRIM(label)) BETWEEN 1 AND 120) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'ai_provider_credentials'::regclass
      AND conname = 'ai_provider_credentials_task_check'
  ) THEN
    ALTER TABLE ai_provider_credentials
      ADD CONSTRAINT ai_provider_credentials_task_check
      CHECK (task IN ('media_templates_text', 'inbox_reply', 'content_review', 'general_test')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'ai_provider_credentials'::regclass
      AND conname = 'ai_provider_credentials_model_check'
  ) THEN
    ALTER TABLE ai_provider_credentials
      ADD CONSTRAINT ai_provider_credentials_model_check
      CHECK (LENGTH(BTRIM(model)) BETWEEN 1 AND 120) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'ai_provider_credentials'::regclass
      AND conname = 'ai_provider_credentials_status_check'
  ) THEN
    ALTER TABLE ai_provider_credentials
      ADD CONSTRAINT ai_provider_credentials_status_check
      CHECK (status IN ('active', 'limited', 'expired', 'disabled')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'ai_provider_credentials'::regclass
      AND conname = 'ai_provider_credentials_limits_check'
  ) THEN
    ALTER TABLE ai_provider_credentials
      ADD CONSTRAINT ai_provider_credentials_limits_check
      CHECK (
        priority >= 0
        AND (daily_limit IS NULL OR daily_limit > 0)
        AND (minute_limit IS NULL OR minute_limit > 0)
        AND jsonb_typeof(metadata) = 'object'
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'ai_provider_usage_events'::regclass
      AND conname = 'ai_provider_usage_events_event_type_check'
  ) THEN
    ALTER TABLE ai_provider_usage_events
      ADD CONSTRAINT ai_provider_usage_events_event_type_check
      CHECK (event_type IN ('selected', 'request_success', 'request_error', 'rate_limited', 'expired', 'disabled')) NOT VALID;
  END IF;
END $$;

ALTER TABLE ai_provider_credentials
  VALIDATE CONSTRAINT ai_provider_credentials_provider_check;
ALTER TABLE ai_provider_credentials
  VALIDATE CONSTRAINT ai_provider_credentials_label_check;
ALTER TABLE ai_provider_credentials
  VALIDATE CONSTRAINT ai_provider_credentials_task_check;
ALTER TABLE ai_provider_credentials
  VALIDATE CONSTRAINT ai_provider_credentials_model_check;
ALTER TABLE ai_provider_credentials
  VALIDATE CONSTRAINT ai_provider_credentials_status_check;
ALTER TABLE ai_provider_credentials
  VALIDATE CONSTRAINT ai_provider_credentials_limits_check;
ALTER TABLE ai_provider_usage_events
  VALIDATE CONSTRAINT ai_provider_usage_events_event_type_check;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_provider_credentials_active_label
  ON ai_provider_credentials(workspace_id, provider, LOWER(label))
  WHERE disabled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_provider_credentials_select
  ON ai_provider_credentials(workspace_id, provider, task, status, priority, updated_at);

CREATE INDEX IF NOT EXISTS idx_ai_provider_usage_events_credential
  ON ai_provider_usage_events(credential_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_provider_usage_events_workspace
  ON ai_provider_usage_events(workspace_id, provider, task, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_ai_provider_credentials_updated_at'
      AND tgrelid = 'ai_provider_credentials'::regclass
  ) THEN
    CREATE TRIGGER trg_ai_provider_credentials_updated_at
    BEFORE UPDATE ON ai_provider_credentials
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMIT;
