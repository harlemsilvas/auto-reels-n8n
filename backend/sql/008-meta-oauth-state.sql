\set ON_ERROR_STOP on

BEGIN;

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'socialbot_oauth_states'::regclass
      AND conname = 'socialbot_oauth_states_provider_check'
  ) THEN
    ALTER TABLE socialbot_oauth_states
      ADD CONSTRAINT socialbot_oauth_states_provider_check
      CHECK (provider IN ('meta')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'socialbot_oauth_states'::regclass
      AND conname = 'socialbot_oauth_states_expiration_check'
  ) THEN
    ALTER TABLE socialbot_oauth_states
      ADD CONSTRAINT socialbot_oauth_states_expiration_check
      CHECK (expires_at > created_at) NOT VALID;
  END IF;
END $$;

ALTER TABLE socialbot_oauth_states
  VALIDATE CONSTRAINT socialbot_oauth_states_provider_check;
ALTER TABLE socialbot_oauth_states
  VALIDATE CONSTRAINT socialbot_oauth_states_expiration_check;

CREATE UNIQUE INDEX IF NOT EXISTS uq_socialbot_oauth_states_hash
  ON socialbot_oauth_states(state_hash);

CREATE INDEX IF NOT EXISTS idx_socialbot_oauth_states_session
  ON socialbot_oauth_states(session_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_socialbot_oauth_states_active
  ON socialbot_oauth_states(expires_at)
  WHERE consumed_at IS NULL;

COMMIT;
